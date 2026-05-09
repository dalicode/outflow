import { describe, expect, it, vi } from "vitest";
import { editableCellActivate } from "../features/dashboard/expenseColumns";
import type { CellEditingAPI } from "../features/dashboard/useExpenseCellEditing";
import type { Expense } from "../types";

function createEditingMock(): CellEditingAPI {
  return {
    editingCell: null,
    validationError: null,
    switchCellEdit: vi.fn(),
    startCellEdit: vi.fn(),
    cancelCurrentCellEdit: vi.fn(),
    isCellEditing: vi.fn(),
    createOnCommit: vi.fn(),
    createOnCancel: vi.fn(),
    handleTabNavigation: vi.fn(),
    validateField: vi.fn(),
    setPendingName: vi.fn(),
    getPendingName: vi.fn(),
    shouldAutoOpenEditor: vi.fn(),
  };
}

function createExpense(): Expense {
  return {
    id: 1,
    date: "2026-05-05",
    amount: 1,
    description: "test",
    categoryId: 1,
    payeeId: 1,
  } as unknown as Expense;
}

describe("editableCellActivate", () => {
  it("activates only from pointer down and does not expose a click handler", () => {
    const editing = createEditingMock();
    const handlers = editableCellActivate(editing, createExpense(), "date");

    expect("onClick" in handlers).toBe(false);

    handlers.onPointerDown({
      button: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.createElement("span"),
    } as any);

    expect(editing.switchCellEdit).toHaveBeenCalledTimes(1);
    expect(editing.switchCellEdit).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1 }),
      "date",
    );
  });

  it("ignores non-primary clicks and no-cell-switch targets", () => {
    const editing = createEditingMock();
    const handlers = editableCellActivate(editing, createExpense(), "payeeId");

    const noSwitchTarget = document.createElement("span");
    vi.spyOn(noSwitchTarget, "closest").mockReturnValue(document.createElement("div"));

    handlers.onPointerDown({
      button: 2,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: document.createElement("span"),
    } as any);

    handlers.onPointerDown({
      button: 0,
      preventDefault: vi.fn(),
      stopPropagation: vi.fn(),
      target: noSwitchTarget,
    } as any);

    expect(editing.switchCellEdit).not.toHaveBeenCalled();
  });
});
