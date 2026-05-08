import { useState, useMemo } from "react";
import { normalizeName } from "../../utils/normalizeName";
import { usePayees } from "../../hooks/useLocalData";
import { useToasts } from "../../context/toastContext";
import { StorageService } from "../../services/storageService";
import EntityMergeDialog from "../../components/ui/EntityMergeDialog";
import DeleteEntityDialog from "../../components/ui/DeleteEntityDialog";
import type { Payee } from "../../types";
import EmptyState from "../../components/ui/EmptyState";

export default function PayeesPage() {
  const { payees, refresh } = usePayees();
  const { showUndoToast } = useToasts();
  const [search, setSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [mergeSource, setMergeSource] = useState<Payee | null>(null);
  const [mergeExpenseCount, setMergeExpenseCount] = useState(0);
  const [deleteTarget, setDeleteTarget] = useState<Payee | null>(null);

  const activePayees = useMemo(
    () => payees.filter((p) => !p.isArchived),
    [payees],
  );

  const sortedPayees = useMemo(
    () => [...activePayees].sort((a, b) => a.name.localeCompare(b.name)),
    [activePayees],
  );

  const filteredPayees = useMemo(() => {
    if (!search.trim()) return sortedPayees;
    const q = search.toLowerCase();
    return sortedPayees.filter((p) => p.name.toLowerCase().includes(q));
  }, [sortedPayees, search]);

  const handleAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    try {
      await StorageService.addPayee(trimmed);
      setNewName("");
      setError("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const startEdit = (payee: Payee) => {
    setEditingId(payee.id as number);
    setEditName(payee.name);
    setError("");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditName("");
    setError("");
  };

  const saveEdit = async (id: number) => {
    const trimmed = editName.trim();
    if (!trimmed) return;
    try {
      await StorageService.updatePayee(id, trimmed);
      setEditingId(null);
      setEditName("");
      setError("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const handleDelete = async (id: number) => {
    await StorageService.archivePayee(id);
    showUndoToast("Payee archived.", async () => {
      await StorageService.unarchivePayee(id);
      refresh();
    });
    refresh();
  };

  const openMerge = async (payee: Payee) => {
    const count = await StorageService.getExpenseCountForPayee(
      payee.id as number,
    );
    setMergeExpenseCount(count);
    setMergeSource(payee);
  };

  const handleMerge = async (targetId: number) => {
    await StorageService.mergePayee(mergeSource!.id as number, targetId);
    setMergeSource(null);
    refresh();
  };

  return (
    <>
      <div
        className="w-full max-w-4xl mx-auto px-4 py-6 space-y-6"
        data-testid="payees-page"
      >
        <h1 className="text-xl font-bold text-theme-text">Payees</h1>

        {/* Search + Add */}
        <div className="flex flex-col md:max-w-3xl mx-auto sm:flex-row gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search payees..."
            className="input-md flex-1"
          />
          <div className="flex gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New payee name"
              className="input-md flex-1 sm:w-48"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAdd();
              }}
            />
            <button
              onClick={handleAdd}
              disabled={!newName.trim()}
              data-testid="btn-add-payee"
              className="bg-theme-primary hover:opacity-90 disabled:opacity-40 text-white text-xs font-medium px-4 py-2 rounded-theme-small transition-opacity whitespace-nowrap"
            >
              Add
            </button>
          </div>
        </div>

        {error && <p className="text-xs text-theme-danger">{error}</p>}

        {/* List */}
        <div className="space-y-1 md:max-w-3xl mx-auto">
          {filteredPayees.map((payee) => (
            <div
              key={payee.id}
              data-testid={`payee-row-${payee.id}`}
              className="flex items-center justify-between py-2 px-3 rounded-theme-small border-b border-theme-border hover:bg-theme-background transition-colors"
            >
              {editingId === payee.id ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="input-sm flex-1"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEdit(payee.id as number);
                      if (e.key === "Escape") cancelEdit();
                    }}
                  />
                  <button
                    onClick={() => saveEdit(payee.id as number)}
                    className="text-xs text-theme-primary font-medium"
                  >
                    Save
                  </button>
                  <button
                    onClick={cancelEdit}
                    className="text-xs text-theme-muted"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <>
                  <span className="text-sm flex-1 text-theme-text">
                    {normalizeName(payee.name)}
                  </span>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => startEdit(payee)}
                      data-testid={`btn-edit-payee-${payee.id}`}
                      className="text-xs text-theme-primary hover:opacity-80 font-medium"
                    >
                      Edit
                    </button>
                    {activePayees.length > 1 && (
                      <button
                        onClick={() => openMerge(payee)}
                        className="text-xs text-theme-muted hover:text-theme-text font-medium"
                      >
                        Merge
                      </button>
                    )}
                    <button
                      onClick={() => setDeleteTarget(payee)}
                      data-testid={`btn-delete-payee-${payee.id}`}
                      className="text-xs text-theme-danger hover:opacity-80"
                    >
                      Delete
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {filteredPayees.length === 0 && (
            <EmptyState
              message={
                search.trim()
                  ? "No payees match your search."
                  : "No payees yet."
              }
            />
          )}
        </div>
      </div>

      {mergeSource && (
        <EntityMergeDialog
          isOpen={true}
          onClose={() => setMergeSource(null)}
          entityType="payee"
          sourceName={mergeSource.name}
          targetOptions={activePayees
            .filter((p) => p.id !== mergeSource.id)
            .map((p) => ({ id: p.id as number, name: p.name }))}
          affectedExpenseCount={mergeExpenseCount}
          onConfirm={handleMerge}
        />
      )}

      {deleteTarget && (
        <DeleteEntityDialog
          isOpen={true}
          onClose={() => setDeleteTarget(null)}
          entityType="payee"
          entityName={deleteTarget.name}
          canMerge={activePayees.length > 1}
          onConfirmDelete={async () => {
            await handleDelete(deleteTarget.id as number);
            setDeleteTarget(null);
          }}
          onMergeInstead={() => {
            openMerge(deleteTarget);
            setDeleteTarget(null);
          }}
        />
      )}
    </>
  );
}
