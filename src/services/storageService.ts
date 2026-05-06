import Dexie, { type Table } from "dexie";
import { isEncryptedEnvelope, decryptBackup } from "../utils/backupCrypto";
import { normalizeName } from "../utils/normalizeName";
import type {
  Expense,
  Category,
  Payee,
  FixedExpense,
  FixedExpenseSnapshot,
  IncomeSnapshot,
  SavingsSnapshot,
  Schedule,
  ScheduleMaterializationNotice,
  SyncQueueItem,
  CategoryMergeHistory,
  PayeeMergeHistory,
} from "../types";
import { buildScheduleMaterializationNotice } from "../utils/scheduleNotificationUtils";

interface Setting {
  key: string;
  value: unknown;
}

class OutflowDB extends Dexie {
  expenses!: Table<Expense, number>;
  categories!: Table<Category, number>;
  payees!: Table<Payee, number>;
  fixedExpenses!: Table<FixedExpense, number>;
  fixedExpenseSnapshots!: Table<FixedExpenseSnapshot, number>;
  incomeSnapshots!: Table<IncomeSnapshot, number>;
  savingsSnapshots!: Table<SavingsSnapshot, number>;
  schedules!: Table<Schedule, number>;
  settings!: Table<Setting, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  categoryMergeHistory!: Table<CategoryMergeHistory, number>;
  payeeMergeHistory!: Table<PayeeMergeHistory, number>;

  constructor() {
    super("Outflow");

    this.version(1).stores({ expenses: "++id, date, category" });
    this.version(2).stores({
      expenses: "++id, date, category",
      settings: "key",
      fixedExpenses: "++id",
    });
    this.version(3).stores({
      expenses: "++id, date, category, categoryId",
      settings: "key",
      fixedExpenses: "++id",
      categories: "++id, name",
    });
    this.version(4).stores({
      expenses: "++id, date, category, categoryId",
      settings: "key",
      fixedExpenses: "++id",
      categories: "++id, name",
      syncQueue: "++id, table, timestamp",
    });
    this.version(5).stores({
      expenses: "++id, date, category, categoryId",
      settings: "key",
      fixedExpenses: "++id",
      categories: "++id, name",
      syncQueue: "++id, table, timestamp",
      fixedExpenseSnapshots: "++id, [fixedExpenseId+year+month], year, month",
    });
    this.version(6).stores({
      expenses: "++id, date, category, categoryId",
      settings: "key",
      fixedExpenses: "++id",
      categories: "++id, name",
      syncQueue: "++id, table, timestamp",
      fixedExpenseSnapshots: "++id, [fixedExpenseId+year+month], year, month",
      schedules:
        "++id, type, effectiveYear, effectiveMonth, isActive, targetId",
    });
    this.version(7).stores({
      expenses: "++id, date, category, categoryId",
      settings: "key",
      fixedExpenses: "++id",
      categories: "++id, name",
      syncQueue: "++id, table, timestamp",
      fixedExpenseSnapshots: "++id, [fixedExpenseId+year+month], year, month",
      schedules:
        "++id, type, effectiveYear, effectiveMonth, isActive, targetId",
      incomeSnapshots: "++id, [year+month], year, month",
      savingsSnapshots: "++id, [year+month], year, month",
    });
    this.version(8)
      .stores({
        expenses: "++id, date, category, categoryId",
        settings: "key",
        fixedExpenses: "++id",
        categories: "++id, name",
        syncQueue: "++id, table, timestamp",
        fixedExpenseSnapshots: "++id, [fixedExpenseId+year+month], year, month",
        schedules:
          "++id, type, effectiveYear, effectiveMonth, isActive, targetId",
        incomeSnapshots: "++id, [year+month], year, month",
        savingsSnapshots: "++id, [year+month], year, month",
      })
      .upgrade(async (tx) => {
        const rows = await tx.table("fixedExpenses").toArray();
        const now = new Date().toISOString();
        for (const row of rows) {
          await tx.table("fixedExpenses").update(row.id, {
            updatedAt: row.archivedAt || now,
          });
        }
      });

    this.version(9).stores({
      expenses: "++id, date, category, categoryId, payeeId",
      settings: "key",
      fixedExpenses: "++id",
      categories: "++id, name",
      payees: "++id, name",
      syncQueue: "++id, table, timestamp",
      fixedExpenseSnapshots: "++id, [fixedExpenseId+year+month], year, month",
      schedules:
        "++id, type, effectiveYear, effectiveMonth, isActive, targetId",
      incomeSnapshots: "++id, [year+month], year, month",
      savingsSnapshots: "++id, [year+month], year, month",
    });

    this.version(10)
      .stores({
        expenses: "++id, date, categoryId, payeeId",
        settings: "key",
        fixedExpenses: "++id",
        categories: "++id, name",
        payees: "++id, name",
        syncQueue: "++id, table, timestamp",
        fixedExpenseSnapshots: "++id, [fixedExpenseId+year+month], year, month",
        schedules:
          "++id, type, effectiveYear, effectiveMonth, isActive, targetId",
        incomeSnapshots: "++id, [year+month], year, month",
        savingsSnapshots: "++id, [year+month], year, month",
      })
      .upgrade(async (tx) => {
        // Migrate expense category/payee strings to IDs
        const expenses = await tx.table("expenses").toArray();
        const categories = await tx.table("categories").toArray();
        const payees = await tx.table("payees").toArray();
        const catByName = new Map(
          categories.map((c: Category) => [c.name.toLowerCase(), c.id]),
        );
        const payeeByName = new Map(
          payees.map((p: Payee) => [p.name.toLowerCase(), p.id]),
        );

        for (const exp of expenses) {
          const updates: Partial<Expense> = {};
          if (!exp.categoryId && (exp as Record<string, unknown>).category) {
            const catId = catByName.get(
              String((exp as Record<string, unknown>).category).toLowerCase(),
            );
            if (catId) updates.categoryId = catId;
          }
          if (!exp.payeeId && (exp as Record<string, unknown>).payee) {
            const payeeId = payeeByName.get(
              String((exp as Record<string, unknown>).payee).toLowerCase(),
            );
            if (payeeId) updates.payeeId = payeeId;
          }
          // Convert schedule.category string to categoryId
          const schedules = await tx.table("schedules").toArray();
          for (const s of schedules) {
            if (
              (s as Record<string, unknown>).category &&
              !(s as Record<string, unknown>).categoryId
            ) {
              const catId = catByName.get(
                String((s as Record<string, unknown>).category).toLowerCase(),
              );
              if (catId) {
                await tx.table("schedules").update(s.id, { categoryId: catId });
              }
            }
          }
          if (Object.keys(updates).length > 0) {
            await tx.table("expenses").update(exp.id, updates);
          }
        }
      });

    this.version(11).stores({
      expenses: "++id, date, categoryId, payeeId",
      settings: "key",
      fixedExpenses: "++id",
      categories: "++id, name",
      payees: "++id, name",
      syncQueue: "++id, table, timestamp",
      fixedExpenseSnapshots: "++id, [fixedExpenseId+year+month], year, month",
      schedules:
        "++id, type, effectiveYear, effectiveMonth, isActive, targetId, payeeId",
      incomeSnapshots: "++id, [year+month], year, month",
      savingsSnapshots: "++id, [year+month], year, month",
    });

    this.version(12).stores({
      expenses: "++id, date, categoryId, payeeId",
      settings: "key",
      fixedExpenses: "++id",
      categories: "++id, name",
      payees: "++id, name",
      syncQueue: "++id, table, timestamp",
      fixedExpenseSnapshots: "++id, [fixedExpenseId+year+month], year, month",
      schedules:
        "++id, type, effectiveYear, effectiveMonth, isActive, targetId, payeeId",
      incomeSnapshots: "++id, [year+month], year, month",
      savingsSnapshots: "++id, [year+month], year, month",
    });

    this.version(13).stores({
      expenses: "++id, date, categoryId, payeeId",
      settings: "key",
      fixedExpenses: "++id",
      categories: "++id, name",
      payees: "++id, name",
      syncQueue: "++id, table, timestamp",
      fixedExpenseSnapshots: "++id, [fixedExpenseId+year+month], year, month",
      schedules:
        "++id, type, effectiveYear, effectiveMonth, isActive, targetId, payeeId",
      incomeSnapshots: "++id, [year+month], year, month",
      savingsSnapshots: "++id, [year+month], year, month",
      categoryMergeHistory: "++id, sourceCategoryId, targetCategoryId",
      payeeMergeHistory: "++id, sourcePayeeId, targetPayeeId",
    });

    this.on("populate", () => {
      const now = new Date().toISOString();
      this.table("categories").bulkAdd(buildDefaultCategories(now));
      this.table("payees").bulkAdd(buildDefaultPayees(now));
    });
  }
}

const db = new OutflowDB();

export const DEFAULT_CATEGORIES = [
  {
    name: "Entertainment",
    aliases: [
      "Entertainment",
      "Games",
      "Gaming",
      "Movies",
      "Movie",
      "Cinema",
      "Concerts",
      "Events",
      "Subscriptions",
      "Streaming",
      "Hobbies",
      "Fun",
    ],
  },
  {
    name: "Health & Medical",
    aliases: [
      "Health",
      "Medical",
      "Health & Medical",
      "Healthcare",
      "Doctor",
      "Dentist",
      "Pharmacy",
      "Medication",
      "Medicine",
      "Prescriptions",
      "Personal Care",
      "Wellness",
    ],
  },
  {
    name: "Miscellaneous",
    aliases: [
      "Miscellaneous",
      "Misc",
      "Other",
      "General",
      "Uncategorized",
      "Unknown",
      "Random",
      "One-off",
      "Adjustment",
      "Refund",
    ],
  },
  {
    name: "Shopping",
    aliases: [
      "Shopping",
      "Clothes",
      "Clothing",
      "Apparel",
      "Shoes",
      "Accessories",
      "Electronics",
      "Material Items",
      "Personal Goods",
      "Retail",
      "Online Shopping",
    ],
  },
  {
    name: "Transportation",
    aliases: [
      "Transportation",
      "Transport",
      "Transit",
      "TTC",
      "Presto",
      "GO Transit",
      "Uber",
      "Lyft",
      "Taxi",
      "Parking",
      "Gas",
      "Fuel",
      "Car",
    ],
  },
  {
    name: "Groceries",
    aliases: [
      "Groceries",
      "Grocery",
      "Groc",
      "Food",
      "Supermarket",
      "Market",
      "Produce",
      "Pantry",
      "Household Groceries",
    ],
  },
  {
    name: "Dining Out",
    aliases: [
      "Dining Out",
      "Dining",
      "Restaurant",
      "Restaurants",
      "Takeout",
      "Take-out",
      "Delivery",
      "Fast Food",
      "Coffee",
      "Cafe",
      "Bubble Tea",
      "Lunch",
      "Dinner",
      "Eating Out",
    ],
  },
  {
    name: "Bills & Utilities",
    aliases: [
      "Bills & Utilities",
      "Bills",
      "Utilities",
      "Hydro",
      "Electricity",
      "Gas Bill",
      "Water",
      "Internet",
      "Phone",
      "Mobile",
      "Insurance",
      "Rent",
      "Subscription Bills",
    ],
  },
  {
    name: "Home",
    aliases: [
      "Home",
      "House",
      "Household",
      "Furniture",
      "Decor",
      "Appliances",
      "Cleaning",
      "Repairs",
      "Maintenance",
      "Kitchen",
      "Bathroom",
      "Bedroom",
      "Home Improvement",
    ],
  },
  {
    name: "Travel",
    aliases: [
      "Travel",
      "Trip",
      "Vacation",
      "Hotel",
      "Flight",
      "Flights",
      "Airfare",
      "Airbnb",
      "Cruise",
      "Luggage",
      "Travel Food",
      "Tourism",
      "Passport",
    ],
  },
  {
    name: "Pets",
    aliases: [
      "Pets",
      "Pet",
      "Cat",
      "Dog",
      "Kitten",
      "Pet Food",
      "Cat Food",
      "Dog Food",
      "Litter",
      "Vet",
      "Veterinary",
      "Pet Supplies",
      "Pet Valu",
    ],
  },
];

export const DEFAULT_PAYEES: { name: string; aliases: string[] }[] = [
  // ── Groceries & Supermarkets ──────────────────────────────────
  {
    name: "Loblaws",
    aliases: [
      "Loblaws",
      "Loblaw",
      "Loblaw's",
      "Loblaw Companies",
      "Loblaws grocery",
    ],
  },
  {
    name: "No Frills",
    aliases: [
      "nofrills",
      "metro+nofrills+shoppers",
      "No Frills",
      "No Frills grocery",
      "No Frills groc",
    ],
  },
  {
    name: "Metro",
    aliases: [
      "Metro",
      "metro+nofrills+shoppers",
      "Metro grocery",
      "Metro groc",
    ],
  },
  { name: "Sobeys", aliases: ["Sobeys", "Sobey's", "Sobeys grocery"] },
  { name: "FreshCo", aliases: ["FreshCo", "Fresh Co", "FreshCo grocery"] },
  {
    name: "Walmart",
    aliases: [
      "Walmart",
      "Walmart order",
      "Walmart Snorkel",
      "Walmart nivea",
      "walmart groc",
      "Walmart pet stuff",
      "Walmart pet food",
      "Walmart haul",
      "Wal-Mart",
      "Walmart Supercentre",
      "Walmart grocery",
    ],
  },
  {
    name: "Costco",
    aliases: [
      "Costco",
      "Costco run",
      "costco food",
      "Costco split",
      "Groc costco",
      "Costco+ foodie",
      "Costco groc",
      "costco",
      "Costco Wholesale",
      "Costco grocery",
    ],
  },
  {
    name: "T&T Supermarket",
    aliases: [
      "T&T",
      "T & T",
      "T&T Supermarket",
      "T and T",
      "Tnt supermarket",
      "Tt groc",
      "T&t groc",
    ],
  },
  { name: "Farm Boy", aliases: ["Farm Boy", "Farmboy", "Farm Boy grocery"] },
  {
    name: "FoodieMart",
    aliases: [
      "Foodiemart",
      "foodiemart",
      "Foodiemart groc",
      "Foodymart",
      "Foody Mart",
      "Foodie Mart",
      "Foodymart groc",
    ],
  },
  {
    name: "Foodyworld",
    aliases: ["Foodyworld", "Foody World", "Foody World grocery"],
  },
  { name: "FreshWay Foodmart", aliases: ["Freshway", "freshway"] },
  {
    name: "Bestco",
    aliases: [
      "Bestco",
      "Bestco Fresh Food Mart",
      "Bestco grocery",
      "Bestco groc",
    ],
  },
  {
    name: "Shoppers Drug Mart",
    aliases: [
      "Shoppers",
      "Shoppers groc",
      "metro+nofrills+shoppers",
      "Shoppers Drug Mart",
      "SDM",
      "Pharmaprix",
      "Shoppers pharmacy",
    ],
  },
  {
    name: "Rexall",
    aliases: ["Rexall", "Rexall Pharmacy", "Rexall Pharma Plus"],
  },
  // ── Dining & Coffee ───────────────────────────────────────────
  {
    name: "Tim Hortons",
    aliases: [
      "Timmies",
      "Tim's",
      "Tims",
      "Tim+big beef",
      "Tim Hortons",
      "Tim Horton's",
      "Tim Horton",
    ],
  },
  { name: "Starbucks", aliases: ["Starbucks", "Starbucks Coffee", "Sbux"] },
  {
    name: "McDonald's",
    aliases: [
      "Mcdonald",
      "Mcdonalds",
      "mcdonalds",
      "mcdoland",
      "Mcdoland",
      "Macd",
      "McDonald's",
      "McD",
    ],
  },
  { name: "Subway", aliases: ["Subway", "subway", "Subway Sandwiches"] },
  { name: "Pizza Pizza", aliases: ["Pizza pizza", "Pizzapizza"] },
  { name: "Pizza Hut", aliases: ["pizza hut", "Pizza hut"] },
  { name: "Harvey's", aliases: ["Harvey's", "Harveys", "Harvey"] },
  { name: "Swiss Chalet", aliases: ["Swiss Chalet", "Swisschalet"] },
  {
    name: "The Keg",
    aliases: ["The Keg", "Keg", "Keg Steakhouse", "The Keg Steakhouse"],
  },
  { name: "A&W", aliases: ["AW", "A&w", "Moonstone gas + aw"] },
  { name: "KFC", aliases: ["Kfc", "KFC"] },
  { name: "Popeyes", aliases: ["Popeyes", "popeyes", "Popeyes+booster"] },
  { name: "Church's Chicken", aliases: ["Churchs", "doordash churchs"] },
  { name: "Chipotle", aliases: ["Chipotle", "Chipot"] },
  {
    name: "Coco Fresh Tea & Juice",
    aliases: [
      "Coco",
      "coco",
      "minus coco",
      "Lazeez + coco",
      "coco+padthai",
      "Coco+pho",
      "Coco Fresh Tea",
      "Coco Fresh Tea & Juice",
      "Coco Tea",
      "Coco bubble tea",
    ],
  },
  {
    name: "Real Fruit Bubble Tea",
    aliases: ["Real fruit", "realfruit", "Realfruit"],
  },
  { name: "Chatime", aliases: ["chatime"] },
  { name: "The Alley", aliases: ["Alley"] },
  {
    name: "Molly Tea",
    aliases: ["Molly Tea", "Mollytea", "Molly Tea Toronto", "Molly bubble tea"],
  },
  { name: "Osmow's", aliases: ["Osmow", "osmow", "Osmows", "Uber osmow"] },
  {
    name: "Bolet / Bole Burrito",
    aliases: [
      "Bolet",
      "bolet",
      "bole burrito",
      "Bolel burritos",
      "bolel again",
    ],
  },
  { name: "JCP", aliases: ["JCP", "Jcp", "jcp", "uber eats jcp cancel"] },
  { name: "Lazeez", aliases: ["Lazeez", "Lazeez + coco"] },
  { name: "Jimmy the Greek", aliases: ["Jimmy the greek", "Jimmy the Greek"] },
  { name: "Chamsine", aliases: ["Chamseen", "Chamsine", "chamsine"] },
  { name: "NYF", aliases: ["Nyf", "NYF"] },
  { name: "Boustan", aliases: ["Boustan", "Boustan shwarma"] },
  { name: "Rolltation", aliases: ["Rolltation", "rolltation"] },
  { name: "Daimaru", aliases: ["Daimaru", "daimaru"] },
  { name: "Brown Donkatsu", aliases: ["Brown donkatsu", "brown donkatsu"] },
  { name: "Mogouyan", aliases: ["Mogouyan"] },
  { name: "Noodle Legend", aliases: ["Noodle legend", "noodle legend"] },
  { name: "Haidilao", aliases: ["haidilao", "Haidilao"] },
  { name: "Gyubee", aliases: ["Gyubee"] },
  { name: "Dragon Legend", aliases: ["Dragon Legend", "Dragon legend"] },
  { name: "Ramen Isshin", aliases: ["Ramen isshin", "Ramen Isshin"] },
  { name: "China Cottage", aliases: ["China cottage"] },
  { name: "Hey Noodles", aliases: ["Heynood"] },
  { name: "Yakiniku Like", aliases: ["Yakiniku LIke", "yakiniku like"] },
  {
    name: "Uber Eats",
    aliases: ["Uber Eats", "Ubereats", "Uber *Eats", "Uber Eats order"],
  },
  {
    name: "DoorDash",
    aliases: ["DoorDash", "Door Dash", "DD", "DD Canada", "Doordash order"],
  },
  {
    name: "SkipTheDishes",
    aliases: ["SkipTheDishes", "Skip The Dishes", "Skip", "Skip order"],
  },
  { name: "LCBO", aliases: ["LCBO", "Liquor Control Board of Ontario"] },
  {
    name: "Beer Store",
    aliases: ["Beer Store", "The Beer Store", "Beerstore"],
  },
  // ── Transit & Transportation ──────────────────────────────────
  {
    name: "TTC",
    aliases: ["TTC", "Toronto Transit Commission", "TTC fare", "TTC pass"],
  },
  {
    name: "PRESTO",
    aliases: [
      "Presto",
      "presto",
      "Presto Reload",
      "presto recharge",
      "PResto",
      "Presto card",
      "Presto load",
    ],
  },
  {
    name: "GO Transit",
    aliases: ["GO Transit", "GO Train", "GO Bus", "Metrolinx GO", "GO fare"],
  },
  {
    name: "UP Express",
    aliases: ["UP Express", "Union Pearson Express", "UPX", "UP Express fare"],
  },
  {
    name: "Uber",
    aliases: [
      "Uber",
      "Uber grand one chicken",
      "Uber osmow",
      "uber hospital",
      "uber eats jcp cancel",
      "Uber to aunt",
      "Texas Uber",
      "Uber Trip",
      "Uber *Trip",
      "Uber ride",
      "help.uber.com",
    ],
  },
  { name: "Lyft", aliases: ["Lyft", "Lyft ride", "Lyft Trip"] },
  { name: "407 ETR", aliases: ["407"] },
  { name: "Shell", aliases: ["Shell Gas"] },
  {
    name: "Green P Parking",
    aliases: [
      "Green P",
      "Green P Parking",
      "Toronto Parking Authority",
      "TPA Parking",
      "GreenP",
    ],
  },
  { name: "Impark", aliases: ["Impark", "Imperial Parking", "Impark Parking"] },
  // ── Utilities & Telecom ───────────────────────────────────────
  {
    name: "Toronto Hydro",
    aliases: [
      "Toronto Hydro",
      "Toronto Hydro-Electric",
      "Toronto Hydro Electric System",
      "Hydro bill",
    ],
  },
  {
    name: "Enbridge Gas",
    aliases: ["Enbridge", "Enbridge Gas", "Enbridge Gas Inc", "Gas bill"],
  },
  {
    name: "Rogers",
    aliases: [
      "Rogers",
      "Rogers Communications",
      "Rogers Wireless",
      "Rogers Internet",
      "Rogers bill",
    ],
  },
  {
    name: "Bell",
    aliases: [
      "Bell",
      "Bell Canada",
      "Bell Mobility",
      "Bell Internet",
      "Bell bill",
    ],
  },
  { name: "Telus", aliases: ["Telus", "Telus Mobility", "Telus bill"] },
  {
    name: "Fido",
    aliases: ["Fido setup fee", "Fido", "Fido Mobile", "Fido bill"],
  },
  {
    name: "Freedom Mobile",
    aliases: ["Freedom Mobile", "Freedom", "Freedom bill"],
  },
  { name: "Koodo", aliases: ["Koodo", "Koodo Mobile", "Koodo bill"] },
  {
    name: "Virgin Plus",
    aliases: ["Virgin extra fees", "Virgin insurance", "Virgin Long distance"],
  },
  { name: "Ubigi", aliases: ["Ubigi"] },
  // ── Banking & Finance ─────────────────────────────────────────
  {
    name: "RBC",
    aliases: [
      "RBC",
      "Royal Bank",
      "Royal Bank of Canada",
      "RBC fee",
      "RBC Visa",
    ],
  },
  {
    name: "TD Bank",
    aliases: [
      "TD",
      "TD Bank",
      "TD Canada Trust",
      "Toronto Dominion",
      "TD fee",
      "TD Visa",
    ],
  },
  {
    name: "Scotiabank",
    aliases: [
      "Scotiabank",
      "Scotia",
      "Bank of Nova Scotia",
      "Scotia fee",
      "Scotia Visa",
    ],
  },
  {
    name: "BMO",
    aliases: ["BMO", "Bank of Montreal", "BMO fee", "BMO Mastercard"],
  },
  {
    name: "CIBC",
    aliases: [
      "CIBC",
      "Canadian Imperial Bank of Commerce",
      "CIBC fee",
      "CIBC Visa",
    ],
  },
  {
    name: "Tangerine",
    aliases: ["Tangerine", "Tangerine Bank", "Tangerine fee"],
  },
  { name: "EQ Bank", aliases: ["EQ Bank", "Equitable Bank", "EQ"] },
  // ── Retail & Shopping ─────────────────────────────────────────
  {
    name: "Amazon",
    aliases: [
      "Amazon",
      "Amazon haul",
      "Amazon Kitten Stuff",
      "Amazon Watch strap",
      "Amazon.ca",
      "AMZN",
      "AMZN MKTP",
      "Amazon Marketplace",
      "Amazon order",
    ],
  },
  {
    name: "Temu",
    aliases: [
      "Temu",
      "Temu haul",
      "Temu order",
      "temu stuff",
      "Temu haul2",
      "White board temu",
    ],
  },
  {
    name: "Uniqlo",
    aliases: ["Uniqlo", "uniqlo haul", "Uniqlo shirt", "Uniqlo shirts"],
  },
  { name: "IKEA", aliases: ["Ikea", "Ikea stuff", "ikea return"] },
  {
    name: "Winners",
    aliases: [
      "Winners",
      "bracelet winners",
      "Winners shorts",
      "Winners outing",
      "Winners haul",
    ],
  },
  { name: "HomeSense", aliases: ["Homesense"] },
  { name: "H&M", aliases: ["H&M", "H and M", "HM", "Hennes Mauritz"] },
  { name: "Zara", aliases: ["zara", "Zara return", "Zara Canada"] },
  { name: "MUJI", aliases: ["muji"] },
  {
    name: "Canadian Tire",
    aliases: ["Canadian Tire", "Cdn Tire", "CTC", "CanadianTire"],
  },
  {
    name: "Home Depot",
    aliases: ["Home Depot", "The Home Depot", "Homedepot"],
  },
  { name: "Best Buy", aliases: ["Best Buy", "Bestbuy", "Best Buy Canada"] },
  { name: "Sport Chek", aliases: ["Sport Chek", "Sportchek", "Sport Check"] },
  { name: "Dollarama", aliases: ["Dollarama Haul", "dollarama"] },
  { name: "Value Village", aliases: ["value village", "Value village"] },
  { name: "Grailed", aliases: ["Grailed haul", "grailed refund"] },
  { name: "Buyee", aliases: ["Buyee duties"] },
  { name: "FromJapan", aliases: ["Fromjapan shipping", "Duties fromjapan"] },
  { name: "Aliexpress", aliases: ["AliExpress", "Ali Express", "Ali stuff"] },
  { name: "Shein", aliases: ["Shein", "Shein order"] },
  { name: "SSENSE", aliases: ["SSENSE", "SSENSE Canada"] },
  {
    name: "Facebook Marketplace",
    aliases: [
      "FB Market",
      "FB Marketplace",
      "Facebook Marketplace",
      "Marketplace",
    ],
  },
  { name: "Poshmark", aliases: ["Poshmark", "Poshmark Canada"] },
  { name: "Etsy", aliases: ["Etsy", "Etsy Canada", "Etsy order"] },
  {
    name: "Indigo",
    aliases: ["Indigo", "Chapters", "Indigo Books", "Chapters Indigo"],
  },
  {
    name: "Apple",
    aliases: [
      "Apple",
      "Apple Store",
      "Apple.com",
      "Apple Services",
      "iCloud",
      "Apple Canada",
    ],
  },
  { name: "Pet Valu", aliases: ["Pet Valu Food", "petvalu"] },
  // ── Entertainment & Subscriptions ─────────────────────────────
  {
    name: "Netflix",
    aliases: [
      "PAYPAL NETFLIX",
      "PAYPAL *NETFLIX",
      "Netflix",
      "Netflix.com",
      "Netflix CA",
    ],
  },
  { name: "Spotify", aliases: ["Spotify", "Spotify Premium", "Spotify CA"] },
  {
    name: "Disney+",
    aliases: ["Disney+", "Disney Plus", "Disneyplus", "Disney Plus Canada"],
  },
  { name: "Crave", aliases: ["Crave", "Crave TV", "CraveTV", "Bell Crave"] },
  {
    name: "YouTube Premium",
    aliases: ["YouTube Premium", "YouTube", "Google YouTube"],
  },
  {
    name: "Apple TV+",
    aliases: ["Apple TV+", "Apple TV Plus", "Apple TV", "Apple Services"],
  },
  {
    name: "Xbox Game Pass",
    aliases: [
      "Xbox Game Pass",
      "Game Pass",
      "Microsoft Game Pass",
      "Xbox",
      "Microsoft Xbox",
    ],
  },
  {
    name: "Blizzard / Battle.net",
    aliases: ["Blizzard", "blizz sub", "Diablo 4"],
  },
  {
    name: "Canada's Wonderland",
    aliases: ["Wonderland", "wonderland", "Wonderland food", "Gold pass"],
  },
  // ── Health & Wellness ─────────────────────────────────────────
  { name: "GoodLife Fitness", aliases: ["GoodLife", "GoodLife Fitness"] },
  { name: "Planet Fitness", aliases: ["Planet Fitness", "PlanetFitness"] },
  { name: "OHIP", aliases: ["OHIP", "Ontario Health Insurance Plan"] },
  // ── Services & Other ──────────────────────────────────────────
  {
    name: "Canada Post",
    aliases: [
      "Canada Post",
      "Canadapost",
      "Post Office",
      "Canada Post shipping",
    ],
  },
  {
    name: "FedEx",
    aliases: ["FedEx", "Federal Express", "FedEx shipping", "FedEx duties"],
  },
  {
    name: "UPS",
    aliases: [
      "UPS",
      "United Parcel Service",
      "UPS fee",
      "UPS duties",
      "UPS shipping",
    ],
  },
  {
    name: "City of Toronto",
    aliases: [
      "City of Toronto",
      "Toronto Property Tax",
      "Toronto Utility Bill",
      "Toronto Water",
      "Municipal Licensing",
    ],
  },
  {
    name: "Service Ontario",
    aliases: [
      "Service Ontario",
      "ServiceOntario",
      "Ontario Service",
      "Drivers license renewal",
      "Renew drivers license",
    ],
  },
];

// ── Income & Savings Snapshots ────────────────────────────

export function buildDefaultCategories(now: string): Category[] {
  return DEFAULT_CATEGORIES.map((category) => ({
    name: category.name,
    createdAt: now,
    isArchived: false,
  }));
}

export function buildDefaultPayees(now: string): Payee[] {
  return DEFAULT_PAYEES.map(({ name, aliases }) => ({
    name,
    aliases: aliases ?? [],
    createdAt: now,
    isArchived: false,
  }));
}

async function snapshotIncome(year: number, month: number, amount: number) {
  const existing = await db.incomeSnapshots.where({ year, month }).first();
  if (existing) {
    await db.incomeSnapshots.update(existing.id as number, {
      amountSnapshot: amount,
    });
    const updated = await db.incomeSnapshots.get(existing.id as number);
    await enqueue("incomeSnapshots", "update", updated as unknown as Record<string, unknown>);
  } else {
    const id = await db.incomeSnapshots.add({
      year,
      month,
      amountSnapshot: amount,
      createdAt: new Date().toISOString(),
    });
    const row = await db.incomeSnapshots.get(id);
    await enqueue("incomeSnapshots", "insert", row as unknown as Record<string, unknown>);
  }
}

async function snapshotSavings(year: number, month: number, rate: number) {
  const existing = await db.savingsSnapshots.where({ year, month }).first();
  if (existing) {
    await db.savingsSnapshots.update(existing.id as number, {
      rateSnapshot: rate,
    });
    const updated = await db.savingsSnapshots.get(existing.id as number);
    await enqueue("savingsSnapshots", "update", updated as unknown as Record<string, unknown>);
  } else {
    const id = await db.savingsSnapshots.add({
      year,
      month,
      rateSnapshot: rate,
      createdAt: new Date().toISOString(),
    });
    const row = await db.savingsSnapshots.get(id);
    await enqueue("savingsSnapshots", "insert", row as unknown as Record<string, unknown>);
  }
}

// ── Schedule Materialization ──────────────────────────────
// When a schedule's effective date arrives, execute it by updating the live
// values only. Historical snapshots are written on rollover, so the schedule
// stays active until its effective month has been committed into snapshots.

function compareScheduleDates(aYear: number, aMonth: number, bYear: number, bMonth: number) {
  if (aYear !== bYear) return aYear - bYear;
  return aMonth - bMonth;
}

function isBeforeMonth(year: number, month: number, refYear: number, refMonth: number) {
  return year < refYear || (year === refYear && month < refMonth);
}

function isBeforeOrEqualMonth(year: number, month: number, refYear: number, refMonth: number) {
  return year < refYear || (year === refYear && month <= refMonth);
}

function resolveScheduleValueForMonth(
  schedules: Schedule[],
  targetYear: number,
  targetMonth: number,
  fallbackValue: number,
  type: Schedule["type"],
  targetId: number | null = null,
): number {
  const relevant = schedules
    .filter((schedule) => schedule.isActive === 1 && schedule.type === type)
    .filter((schedule) => targetId == null || schedule.targetId === targetId)
    .sort((a, b) =>
      compareScheduleDates(
        a.effectiveYear,
        a.effectiveMonth,
        b.effectiveYear,
        b.effectiveMonth,
      ),
    );

  if (relevant.length === 0) return fallbackValue;

  const applied = relevant.filter((schedule) =>
    isBeforeOrEqualMonth(
      schedule.effectiveYear,
      schedule.effectiveMonth,
      targetYear,
      targetMonth,
    ),
  );

  if (applied.length > 0) {
    const base = applied[0].previousValue ?? fallbackValue;
    return applied.reduce((value, schedule) => schedule.newValue, base);
  }

  const nextSchedule = relevant.find((schedule) =>
    isBeforeMonth(
      targetYear,
      targetMonth,
      schedule.effectiveYear,
      schedule.effectiveMonth,
    ),
  );

  return nextSchedule?.previousValue ?? fallbackValue;
}

async function materializePendingSnapshots(): Promise<ScheduleMaterializationNotice[]> {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  const schedules = await db.schedules.where("isActive").equals(1).toArray();
  const fixedDefs = await db.fixedExpenses.toArray();
  const fixedDefMap = new Map(fixedDefs.map((f) => [f.id, f]));
  const monthlyIncomeRow = await db.settings.get("monthlyIncome");
  const savingsRateRow = await db.settings.get("savingsRate");
  const noticeRow = await db.settings.get("scheduleMaterializationLog");
  let liveIncome = (monthlyIncomeRow?.value as number) ?? 0;
  let liveSavingsRate = (savingsRateRow?.value as number) ?? 0;
  const existingNoticeLog = Array.isArray(noticeRow?.value)
    ? (noticeRow.value as ScheduleMaterializationNotice[])
    : [];
  const newNotices: ScheduleMaterializationNotice[] = [];

  const dueSchedules = [...schedules]
    .filter((schedule) =>
      schedule.effectiveYear < currentYear ||
      (schedule.effectiveYear === currentYear && schedule.effectiveMonth <= currentMonth),
    )
    .sort((a, b) =>
      compareScheduleDates(
        a.effectiveYear,
        a.effectiveMonth,
        b.effectiveYear,
        b.effectiveMonth,
      ),
    );

  for (const schedule of dueSchedules) {
    if (schedule.type === "income") {
      const firstMaterialization =
        schedule.previousValue == null || schedule.materializedAt == null;
      if (firstMaterialization) {
        await db.schedules.update(schedule.id as number, {
          previousValue: liveIncome,
          materializedAt: currentKey,
        });
        newNotices.push(
          buildScheduleMaterializationNotice(schedule, {
            appliedAt: now.toISOString(),
            previousValue: liveIncome,
          }),
        );
      }
      liveIncome = schedule.newValue;
      await db.settings.put({ key: "monthlyIncome", value: liveIncome });
      await db.settings.put({
        key: "monthlyIncomeUpdatedAt",
        value: `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, "0")}`,
      });
      await enqueue("settings", "upsert", { key: "monthlyIncome", value: liveIncome });
      await enqueue("settings", "upsert", {
        key: "monthlyIncomeUpdatedAt",
        value: `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, "0")}`,
      });
      const updatedSchedule = await db.schedules.get(schedule.id as number);
      await enqueue("schedules", "update", updatedSchedule as unknown as Record<string, unknown>);
    } else if (schedule.type === "savingsRate") {
      const firstMaterialization =
        schedule.previousValue == null || schedule.materializedAt == null;
      if (firstMaterialization) {
        await db.schedules.update(schedule.id as number, {
          previousValue: liveSavingsRate,
          materializedAt: currentKey,
        });
        newNotices.push(
          buildScheduleMaterializationNotice(schedule, {
            appliedAt: now.toISOString(),
            previousValue: liveSavingsRate,
          }),
        );
      }
      liveSavingsRate = schedule.newValue;
      await db.settings.put({ key: "savingsRate", value: liveSavingsRate });
      await db.settings.put({
        key: "savingsRateUpdatedAt",
        value: `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, "0")}`,
      });
      await enqueue("settings", "upsert", { key: "savingsRate", value: liveSavingsRate });
      await enqueue("settings", "upsert", {
        key: "savingsRateUpdatedAt",
        value: `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, "0")}`,
      });
      const updatedSchedule = await db.schedules.get(schedule.id as number);
      await enqueue("schedules", "update", updatedSchedule as unknown as Record<string, unknown>);
    } else if (schedule.type === "fixedExpense" && schedule.targetId != null) {
      const def = fixedDefMap.get(schedule.targetId);
      const firstMaterialization =
        schedule.previousValue == null || schedule.materializedAt == null;
      if (firstMaterialization) {
        await db.schedules.update(schedule.id as number, {
          previousValue: def?.amount ?? 0,
          materializedAt: currentKey,
        });
        newNotices.push(
          buildScheduleMaterializationNotice(schedule, {
            appliedAt: now.toISOString(),
            previousValue: def?.amount ?? 0,
            label: def?.name ?? "Fixed expense",
          }),
        );
      }
      if (def) {
        await db.fixedExpenses.update(schedule.targetId, {
          amount: schedule.newValue,
          updatedAt: now.toISOString(),
        });
        def.amount = schedule.newValue;
        def.updatedAt = now.toISOString();
        const updatedDef = await db.fixedExpenses.get(schedule.targetId);
        await enqueue("fixedExpenses", "update", updatedDef as unknown as Record<string, unknown>);
      }
      const updatedSchedule = await db.schedules.get(schedule.id as number);
      await enqueue("schedules", "update", updatedSchedule as unknown as Record<string, unknown>);
    } else if (schedule.type === "expense") {
      const day = schedule.day ?? 1;
      const date = `${schedule.effectiveYear}-${String(schedule.effectiveMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
      const expenseId = await db.expenses.add({
        date,
        amount: schedule.newValue,
        categoryId: schedule.categoryId,
        description: schedule.note,
        createdAt: now.toISOString(),
      });
      const expenseRow = await db.expenses.get(expenseId);
      await enqueue("expenses", "insert", expenseRow as unknown as Record<string, unknown>);
      newNotices.push(
        buildScheduleMaterializationNotice(schedule, {
          appliedAt: now.toISOString(),
          label: schedule.note?.trim() || "Planned expense",
        }),
      );
      await db.schedules.update(schedule.id as number, { isActive: 0 });
      const updatedSchedule = await db.schedules.get(schedule.id as number);
      await enqueue("schedules", "update", updatedSchedule as unknown as Record<string, unknown>);
    }
  }

  if (newNotices.length > 0) {
    const mergedLog = [...newNotices, ...existingNoticeLog].slice(0, 20);
    await db.settings.put({
      key: "scheduleMaterializationLog",
      value: mergedLog,
    });
  }

  return newNotices;
}

// ── Monthly Snapshot Rollover ─────────────────────────────
// When the app opens in a new month, automatically create snapshots
// for any past gap months using the live values that are in effect at rollover time.
// This backfills missed months so later live edits do not retroactively change them.

async function rolloverSnapshots() {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  const currentKey = `${currentYear}-${String(currentMonth).padStart(2, "0")}`;

  const lastOpenRow = await db.settings.get("lastAppOpenMonthKey");
  const lastOpenKey = lastOpenRow?.value as string | undefined;

  // First-time: initialize without rollover
  if (!lastOpenKey) {
    await db.settings.put({ key: "lastAppOpenMonthKey", value: currentKey });
    await enqueue("settings", "upsert", { key: "lastAppOpenMonthKey", value: currentKey });
    return;
  }

  // Backward time travel guard
  if (lastOpenKey >= currentKey) {
    await db.settings.put({ key: "lastAppOpenMonthKey", value: currentKey });
    await enqueue("settings", "upsert", { key: "lastAppOpenMonthKey", value: currentKey });
    return;
  }

  // Parse last open month
  const [lastYearStr, lastMonthStr] = lastOpenKey.split("-");
  const lastYear = parseInt(lastYearStr, 10);
  const lastMonth = parseInt(lastMonthStr, 10);

  // Build list of months to snapshot — includes the last open month and all
  // skipped months up to (but not including) the current month.
  const gapMonths: { year: number; month: number }[] = [];
  let y = lastYear;
  let m = lastMonth;
  while (true) {
    if (y === currentYear && m === currentMonth) break;
    gapMonths.push({ year: y, month: m });
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }

  if (gapMonths.length === 0) {
    await db.settings.put({ key: "lastAppOpenMonthKey", value: currentKey });
    await enqueue("settings", "upsert", { key: "lastAppOpenMonthKey", value: currentKey });
    return;
  }

  // Load data
  const [
    allFixedDefs,
    incomeSnaps,
    savingsSnaps,
    fixedSnaps,
    globalIncomeRow,
    globalRateRow,
    activeSchedules,
  ] = await Promise.all([
    db.fixedExpenses.toArray(),
    db.incomeSnapshots.toArray(),
    db.savingsSnapshots.toArray(),
    db.fixedExpenseSnapshots.toArray(),
    db.settings.get("monthlyIncome"),
    db.settings.get("savingsRate"),
    db.schedules.where("isActive").equals(1).toArray(),
  ]);

  const activeFixed = allFixedDefs.filter((f) => f.isArchived !== true);
  const globalIncome = (globalIncomeRow?.value as number) ?? 0;
  const globalRate = (globalRateRow?.value as number) ?? 0;

  const incomeToAdd: {
    year: number;
    month: number;
    amountSnapshot: number;
    createdAt: string;
  }[] = [];
  const savingsToAdd: {
    year: number;
    month: number;
    rateSnapshot: number;
    createdAt: string;
  }[] = [];
  const fixedToAdd: {
    fixedExpenseId: number;
    nameSnapshot: string;
    amountSnapshot: number;
    year: number;
    month: number;
    createdAt: string;
  }[] = [];
  const scheduleUpdates: Schedule[] = [];

  for (const { year, month } of gapMonths) {
    const hasIncome = incomeSnaps.some(
      (s) => s.year === year && s.month === month,
    );
    if (!hasIncome) {
      incomeToAdd.push({
        year,
        month,
        amountSnapshot: resolveScheduleValueForMonth(
          activeSchedules,
          year,
          month,
          globalIncome,
          "income",
        ),
        createdAt: now.toISOString(),
      });
    }

    const hasSavings = savingsSnaps.some(
      (s) => s.year === year && s.month === month,
    );
    if (!hasSavings) {
      savingsToAdd.push({
        year,
        month,
        rateSnapshot: resolveScheduleValueForMonth(
          activeSchedules,
          year,
          month,
          globalRate,
          "savingsRate",
        ),
        createdAt: now.toISOString(),
      });
    }

    for (const def of activeFixed) {
      if (!def.id) continue;
      const hasFixed = fixedSnaps.some(
        (s) =>
          s.fixedExpenseId === def.id && s.year === year && s.month === month,
      );
      if (!hasFixed) {
        fixedToAdd.push({
          fixedExpenseId: def.id,
          nameSnapshot: def.name,
          amountSnapshot: resolveScheduleValueForMonth(
            activeSchedules,
            year,
            month,
            def.amount,
            "fixedExpense",
            def.id as number,
          ),
          year,
          month,
          createdAt: now.toISOString(),
        });
      }
    }

    for (const schedule of activeSchedules) {
      if (
        schedule.id != null &&
        isBeforeOrEqualMonth(schedule.effectiveYear, schedule.effectiveMonth, year, month)
      ) {
        scheduleUpdates.push(schedule);
      }
    }
  }

  // Batch write everything in one transaction
  await db.transaction(
    "rw",
    [
      db.incomeSnapshots,
      db.savingsSnapshots,
      db.fixedExpenseSnapshots,
      db.settings,
    ],
    async () => {
      if (incomeToAdd.length) await db.incomeSnapshots.bulkAdd(incomeToAdd);
      if (savingsToAdd.length) await db.savingsSnapshots.bulkAdd(savingsToAdd);
      if (fixedToAdd.length) await db.fixedExpenseSnapshots.bulkAdd(fixedToAdd);
      for (const row of incomeToAdd) {
        await enqueue("incomeSnapshots", "insert", row as unknown as Record<string, unknown>);
      }
      for (const row of savingsToAdd) {
        await enqueue("savingsSnapshots", "insert", row as unknown as Record<string, unknown>);
      }
      for (const row of fixedToAdd) {
        await enqueue("fixedExpenseSnapshots", "insert", row as unknown as Record<string, unknown>);
      }
      const uniqueScheduleIds = new Set(
        scheduleUpdates
          .filter((schedule) => schedule.id != null)
          .map((schedule) => schedule.id as number),
      );
      for (const scheduleId of uniqueScheduleIds) {
        await db.schedules.update(scheduleId, { isActive: 0 });
        const updatedSchedule = await db.schedules.get(scheduleId);
        await enqueue("schedules", "update", updatedSchedule as unknown as Record<string, unknown>);
      }
      await db.settings.put({
        key: "lastAppOpenMonthKey",
        value: currentKey,
      });
      await enqueue("settings", "upsert", { key: "lastAppOpenMonthKey", value: currentKey });
    },
  );
}

// Enqueue a sync operation for the background engine to process

// Enqueue a sync operation for the background engine to process
const enqueue = (
  table: string,
  operation: SyncQueueItem["operation"],
  payload: Record<string, unknown>,
) => db.syncQueue.add({ table, operation, payload, timestamp: Date.now() });

export const StorageService = {
  db,
  // ── Expenses ──────────────────────────────────────────────
  getAll: () => db.expenses.orderBy("date").toArray(),
  add: async (expense: Omit<Expense, "id">) => {
    const id = await db.expenses.add(expense as Expense);
    await enqueue("expenses", "insert", { ...expense, id });
    return id;
  },
  update: async (id: number, changes: Partial<Expense>) => {
    await db.expenses.update(id, changes);
    const row = await db.expenses.get(id);
    await enqueue(
      "expenses",
      "update",
      row as unknown as Record<string, unknown>,
    );
  },
  remove: async (id: number) => {
    await db.expenses.delete(id);
    await enqueue("expenses", "delete", { id });
  },
  removeMany: async (ids: number[]) => {
    await db.transaction("rw", db.expenses, db.syncQueue, async () => {
      await db.expenses.bulkDelete(ids);
      for (const id of ids) {
        await enqueue("expenses", "delete", { id });
      }
    });
  },

  // ── Settings ──────────────────────────────────────────────
  getSetting: async <T>(
    key: string,
    fallback: T | null = null,
  ): Promise<T | null> => {
    const row = await db.settings.get(key);
    return row ? (row.value as T) : fallback;
  },
  setSetting: async (key: string, value: unknown) => {
    await db.settings.put({ key, value });
    await enqueue("settings", "upsert", { key, value });
  },

  // ── Fixed Expenses ────────────────────────────────────────
  getFixedExpenses: () => db.fixedExpenses.toArray(),
  // Active fixed expenses only (excludes archived / historical entries)
  getActiveFixedExpenses: () =>
    db.fixedExpenses
      .toArray()
      .then((all) => all.filter((f) => f.isArchived !== true)),
  addFixedExpense: async (item: Omit<FixedExpense, "id">) => {
    const now = new Date().toISOString();
    const id = await db.fixedExpenses.add({
      ...item,
      updatedAt: now,
    } as FixedExpense);
    const row = await db.fixedExpenses.get(id);
    await enqueue(
      "fixedExpenses",
      "insert",
      row as unknown as Record<string, unknown>,
    );
    return id;
  },
  // Creates an archived fixed-expense definition for historical data editing.
  // Month-specific rows are written separately by the historical-data workflow.
  addArchivedFixedExpense: async (item: Omit<FixedExpense, "id">) => {
    const payload = {
      ...item,
      isArchived: true,
      archivedAt: new Date().toISOString(),
    };
    const id = await db.fixedExpenses.add(payload as FixedExpense);
    const row = await db.fixedExpenses.get(id);
    await enqueue(
      "fixedExpenses",
      "insert",
      row as unknown as Record<string, unknown>,
    );
    return id;
  },
  updateFixedExpense: async (id: number, changes: Partial<FixedExpense>) => {
    await db.fixedExpenses.update(id, {
      ...changes,
      updatedAt: new Date().toISOString(),
    });
    const row = await db.fixedExpenses.get(id);
    await enqueue(
      "fixedExpenses",
      "update",
      row as unknown as Record<string, unknown>,
    );
  },
  removeFixedExpense: async (id: number) => {
    await db.fixedExpenses.delete(id);
    await enqueue("fixedExpenses", "delete", { id });
  },

  // ── Fixed Expense Snapshots ───────────────────────────────
  // Returns all snapshots for a given year
  getSnapshotsForYear: (year: number) =>
    db.fixedExpenseSnapshots.where("year").equals(year).toArray(),
  getAllFixedExpenseSnapshots: () => db.fixedExpenseSnapshots.toArray(),
  bulkUpsertSnapshots: (rows: FixedExpenseSnapshot[]) =>
    db.fixedExpenseSnapshots.bulkPut(rows),
  deleteSnapshotsForYear: (year: number) =>
    db.fixedExpenseSnapshots.where("year").equals(year).delete(),

  // ── Income Snapshots ──────────────────────────────────────
  getIncomeSnapshot: async (
    year: number,
    month: number,
  ): Promise<number | null> => {
    const row = await db.incomeSnapshots.where({ year, month }).first();
    return row ? row.amountSnapshot : null;
  },
  setIncomeSnapshot: snapshotIncome,
  getIncomeSnapshotsForYear: (year: number) =>
    db.incomeSnapshots.where("year").equals(year).toArray(),
  getAllIncomeSnapshots: () => db.incomeSnapshots.toArray(),
  bulkUpsertIncomeSnapshots: (rows: IncomeSnapshot[]) =>
    db.incomeSnapshots.bulkPut(rows),
  deleteIncomeSnapshotsForYear: (year: number) =>
    db.incomeSnapshots.where("year").equals(year).delete(),

  // ── Savings Snapshots ─────────────────────────────────────
  getSavingsSnapshot: async (
    year: number,
    month: number,
  ): Promise<number | null> => {
    const row = await db.savingsSnapshots.where({ year, month }).first();
    return row ? row.rateSnapshot : null;
  },
  setSavingsSnapshot: snapshotSavings,
  getSavingsSnapshotsForYear: (year: number) =>
    db.savingsSnapshots.where("year").equals(year).toArray(),
  getAllSavingsSnapshots: () => db.savingsSnapshots.toArray(),
  bulkUpsertSavingsSnapshots: (rows: SavingsSnapshot[]) =>
    db.savingsSnapshots.bulkPut(rows),
  deleteSavingsSnapshotsForYear: (year: number) =>
    db.savingsSnapshots.where("year").equals(year).delete(),

  // ── Schedule Materialization ──────────────────────────────
  materializePendingSnapshots,
  rolloverSnapshots,

  // ── Scheduled Changes ─────────────────────────────────────
  getSchedules: () => db.schedules.toArray(),
  getActiveSchedules: () => db.schedules.where("isActive").equals(1).toArray(),
  addSchedule: async (
    schedule: Omit<Schedule, "id" | "isActive" | "createdAt">,
  ) => {
    const id = await db.schedules.add({
      ...schedule,
      isActive: 1,
      createdAt: new Date().toISOString(),
    } as Schedule);
    const row = await db.schedules.get(id);
    await enqueue(
      "schedules",
      "insert",
      row as unknown as Record<string, unknown>,
    );
    return id;
  },
  updateSchedule: async (id: number, changes: Partial<Schedule>) => {
    await db.schedules.update(id, changes);
    const row = await db.schedules.get(id);
    await enqueue(
      "schedules",
      "update",
      row as unknown as Record<string, unknown>,
    );
  },
  deleteSchedule: async (id: number) => {
    await db.schedules.delete(id);
    await enqueue("schedules", "delete", { id });
  },

  // ── Categories ────────────────────────────────────────────
  getCategories: () => db.categories.toArray(),
  addCategory: async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Category name is required");
    const normalized = normalizeName(trimmed);
    const existing = await db.categories
      .where("name")
      .equalsIgnoreCase(trimmed)
      .first();
    if (existing) {
      if (existing.isArchived) {
        await db.categories.update(existing.id!, {
          name: normalized,
          isArchived: false,
        });
        const row = await db.categories.get(existing.id!);
        await enqueue(
          "categories",
          "update",
          row as unknown as Record<string, unknown>,
        );
        return existing.id!;
      }
      throw new Error("A category with that name already exists");
    }
    const id = await db.categories.add({
      name: normalized,
      createdAt: new Date().toISOString(),
      isArchived: false,
    } as Category);
    const row = await db.categories.get(id);
    await enqueue(
      "categories",
      "insert",
      row as unknown as Record<string, unknown>,
    );
    return id;
  },
  updateCategory: async (id: number, changes: Partial<Category>) => {
    if (changes.name) {
      changes.name = normalizeName(changes.name.trim());
    }
    await db.categories.update(id, changes);
    const row = await db.categories.get(id);
    await enqueue(
      "categories",
      "update",
      row as unknown as Record<string, unknown>,
    );
  },
  deleteCategory: async (id: number) => {
    await db.categories.update(id, { isArchived: true });
    const row = await db.categories.get(id);
    await enqueue(
      "categories",
      "update",
      row as unknown as Record<string, unknown>,
    );
  },

  // ── Payees ────────────────────────────────────────────────
  getPayees: () => db.payees.toArray(),
  getActivePayees: () =>
    db.payees.toArray().then((all) => all.filter((p) => p.isArchived !== true)),
  addPayee: async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Payee name is required");
    const normalized = normalizeName(trimmed);
    const existing = await db.payees
      .where("name")
      .equalsIgnoreCase(trimmed)
      .first();
    if (existing) {
      if (existing.isArchived) {
        await db.payees.update(existing.id!, {
          name: normalized,
          isArchived: false,
        });
        const row = await db.payees.get(existing.id!);
        await enqueue(
          "payees",
          "update",
          row as unknown as Record<string, unknown>,
        );
        return existing.id!;
      }
      throw new Error("A payee with that name already exists");
    }
    const id = await db.payees.add({
      name: normalized,
      createdAt: new Date().toISOString(),
      isArchived: false,
    } as Payee);
    const row = await db.payees.get(id);
    await enqueue(
      "payees",
      "insert",
      row as unknown as Record<string, unknown>,
    );
    return id;
  },
  updatePayee: async (id: number, name: string, aliases?: string[]) => {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Payee name is required");
    const normalized = normalizeName(trimmed);
    const existing = await db.payees
      .where("name")
      .equalsIgnoreCase(trimmed)
      .first();
    if (existing && existing.id !== id)
      throw new Error("A payee with that name already exists");
    const updates: Partial<Payee> = {
      name: normalized,
      updatedAt: new Date().toISOString(),
    };
    if (aliases !== undefined) updates.aliases = aliases;
    await db.payees.update(id, updates);
    const row = await db.payees.get(id);
    await enqueue(
      "payees",
      "update",
      row as unknown as Record<string, unknown>,
    );
  },
  addPayeeAlias: async (id: number, alias: string) => {
    const payee = await db.payees.get(id);
    if (!payee) throw new Error("Payee not found");
    const existing = payee.aliases ?? [];
    const trimmed = alias.trim();
    if (
      !trimmed ||
      existing.some((item) => item.trim().toLowerCase() === trimmed.toLowerCase())
    ) return;
    const updated = [...existing, trimmed];
    await db.payees.update(id, {
      aliases: updated,
      updatedAt: new Date().toISOString(),
    });
    const row = await db.payees.get(id);
    await enqueue(
      "payees",
      "update",
      row as unknown as Record<string, unknown>,
    );
  },
  archivePayee: async (id: number) => {
    await db.payees.update(id, { isArchived: true });
    const row = await db.payees.get(id);
    await enqueue(
      "payees",
      "update",
      row as unknown as Record<string, unknown>,
    );
  },
  unarchivePayee: async (id: number) => {
    await db.payees.update(id, { isArchived: false });
    const row = await db.payees.get(id);
    await enqueue(
      "payees",
      "update",
      row as unknown as Record<string, unknown>,
    );
  },

  // ── Merge ─────────────────────────────────────────────────
  getExpenseCountForCategory: async (categoryId: number): Promise<number> => {
    return db.expenses.where("categoryId").equals(categoryId).count();
  },

  getExpenseCountForPayee: async (payeeId: number): Promise<number> => {
    return db.expenses.where("payeeId").equals(payeeId).count();
  },

  mergeCategory: async (
    sourceCategoryId: number,
    targetCategoryId: number,
  ): Promise<void> => {
    if (sourceCategoryId === targetCategoryId) {
      throw new Error("Cannot merge a category into itself.");
    }
    const now = new Date().toISOString();
    await db.transaction(
      "rw",
      [db.expenses, db.categories, db.categoryMergeHistory],
      async () => {
        const affected = await db.expenses
          .where("categoryId")
          .equals(sourceCategoryId)
          .toArray();
        const affectedIds = affected.map((e) => e.id as number);

        if (affectedIds.length > 0) {
          await db.expenses
            .where("categoryId")
            .equals(sourceCategoryId)
            .modify({ categoryId: targetCategoryId });
        }

        const mergeId = await db.categoryMergeHistory.add({
          sourceCategoryId,
          targetCategoryId,
          affectedExpenseIds: affectedIds,
          createdAt: now,
          revertedAt: null,
        } as CategoryMergeHistory);
        const mergeRow = await db.categoryMergeHistory.get(mergeId);
        if (mergeRow) {
          await enqueue(
            "categoryMergeHistory",
            "insert",
            mergeRow as unknown as Record<string, unknown>,
          );
        }

        await db.categories.update(sourceCategoryId, {
          isArchived: true,
          archivedAt: now,
          mergedIntoCategoryId: targetCategoryId,
          updatedAt: now,
        });
      },
    );
    // Enqueue sync for affected records
    const updatedCat = await db.categories.get(sourceCategoryId);
    await enqueue("categories", "update", updatedCat as unknown as Record<string, unknown>);
  },

  mergePayee: async (
    sourcePayeeId: number,
    targetPayeeId: number,
  ): Promise<void> => {
    if (sourcePayeeId === targetPayeeId) {
      throw new Error("Cannot merge a payee into itself.");
    }
    const now = new Date().toISOString();
    await db.transaction(
      "rw",
      [db.expenses, db.payees, db.payeeMergeHistory],
      async () => {
        const affected = await db.expenses
          .where("payeeId")
          .equals(sourcePayeeId)
          .toArray();
        const affectedIds = affected.map((e) => e.id as number);

        if (affectedIds.length > 0) {
          await db.expenses
            .where("payeeId")
            .equals(sourcePayeeId)
            .modify({ payeeId: targetPayeeId });
        }

        const mergeId = await db.payeeMergeHistory.add({
          sourcePayeeId,
          targetPayeeId,
          affectedExpenseIds: affectedIds,
          createdAt: now,
          revertedAt: null,
        } as PayeeMergeHistory);
        const mergeRow = await db.payeeMergeHistory.get(mergeId);
        if (mergeRow) {
          await enqueue(
            "payeeMergeHistory",
            "insert",
            mergeRow as unknown as Record<string, unknown>,
          );
        }

        await db.payees.update(sourcePayeeId, {
          isArchived: true,
          archivedAt: now,
          mergedIntoPayeeId: targetPayeeId,
          updatedAt: now,
        });
      },
    );
    const updatedPayee = await db.payees.get(sourcePayeeId);
    await enqueue("payees", "update", updatedPayee as unknown as Record<string, unknown>);
  },

  // ── Sync Queue (used by SyncEngine) ──────────────────────
  getSyncQueue: () => db.syncQueue.orderBy("timestamp").toArray(),
  removeSyncQueueItem: (id: number) => db.syncQueue.delete(id),
  clearSyncQueue: () => db.syncQueue.clear(),

  // ── Danger zone ───────────────────────────────────────────
  clearAllData: async () => {
    await db.transaction("rw", db.tables, async () => {
      for (const table of db.tables) {
        await table.clear();
      }
      const now = new Date().toISOString();
      await db.table("categories").bulkAdd(buildDefaultCategories(now));
      await db.table("payees").bulkAdd(buildDefaultPayees(now));
    });
  },

  // ── Bulk upsert (used by incoming sync merge) ─────────────
  bulkUpsertExpenses: (rows: Expense[]) => db.expenses.bulkPut(rows),
  bulkUpsertCategories: (rows: Category[]) => db.categories.bulkPut(rows),
  bulkUpsertPayees: (rows: Payee[]) => db.payees.bulkPut(rows),
  bulkUpsertFixedExpenses: (rows: FixedExpense[]) =>
    db.fixedExpenses.bulkPut(rows),

  // ── Full data backup (JSON export / import) ────────────────
  dbVersion: () => db.verno,

  exportAllData: async () => ({
    expenses: await db.expenses.toArray(),
    categories: await db.categories.toArray(),
    payees: await db.payees.toArray(),
    fixedExpenses: await db.fixedExpenses.toArray(),
    fixedExpenseSnapshots: await db.fixedExpenseSnapshots.toArray(),
    incomeSnapshots: await db.incomeSnapshots.toArray(),
    savingsSnapshots: await db.savingsSnapshots.toArray(),
    schedules: await db.schedules.toArray(),
    settings: await db.settings.toArray(),
    syncQueue: await db.syncQueue.toArray(),
    categoryMergeHistory: await db.categoryMergeHistory.toArray(),
    payeeMergeHistory: await db.payeeMergeHistory.toArray(),
  }),

  importBackup: async (
    data: Record<string, unknown>,
    password: string | null,
    { replace = false } = {},
  ) => {
    if (isEncryptedEnvelope(data)) {
      if (!password) {
        throw new Error("This backup is encrypted. Please enter the password.");
      }
      const decrypted = await decryptBackup(data, password);
      return StorageService.importAllData(decrypted, { replace });
    }
    return StorageService.importAllData(data, { replace });
  },

  importAllData: async (
    data: Record<string, unknown>,
    { replace = false } = {},
  ) => {
    if (!data || typeof data !== "object") {
      throw new Error("Invalid data");
    }

    // Support new { meta, data } format and old flat format
    const payload =
      "data" in data && typeof data.data === "object" && data.data !== null
        ? (data.data as Record<string, unknown>)
        : data;

    if (replace) {
      await db.transaction("rw", db.tables, async () => {
        for (const table of db.tables) {
          await table.clear();
        }
      });
    }

    if (payload.expenses)
      await db.expenses.bulkPut(payload.expenses as Expense[]);
    if (payload.categories)
      await db.categories.bulkPut(payload.categories as Category[]);
    if (payload.payees) await db.payees.bulkPut(payload.payees as Payee[]);
    if (payload.fixedExpenses)
      await db.fixedExpenses.bulkPut(payload.fixedExpenses as FixedExpense[]);
    if (payload.fixedExpenseSnapshots)
      await db.fixedExpenseSnapshots.bulkPut(
        payload.fixedExpenseSnapshots as FixedExpenseSnapshot[],
      );
    if (payload.incomeSnapshots)
      await db.incomeSnapshots.bulkPut(
        payload.incomeSnapshots as IncomeSnapshot[],
      );
    if (payload.savingsSnapshots)
      await db.savingsSnapshots.bulkPut(
        payload.savingsSnapshots as SavingsSnapshot[],
      );
    if (payload.schedules)
      await db.schedules.bulkPut(payload.schedules as Schedule[]);
    if (payload.settings)
      await db.settings.bulkPut(payload.settings as Setting[]);
    if (payload.syncQueue)
      await db.syncQueue.bulkPut(payload.syncQueue as SyncQueueItem[]);
    if (payload.categoryMergeHistory)
      await db.categoryMergeHistory.bulkPut(payload.categoryMergeHistory as CategoryMergeHistory[]);
    if (payload.payeeMergeHistory)
      await db.payeeMergeHistory.bulkPut(payload.payeeMergeHistory as PayeeMergeHistory[]);
  },
};
