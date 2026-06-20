package categoryseed

// SeedNode describes one row in the category tree before insert.
type SeedNode struct {
	SeedID            string
	ParentSeedID      string
	Name              string
	Type              string // income | expense | transfer
	Color             string
	SortOrder         int
	System            bool
	BasiqSubClassCode string
	AnzsicClassCode   string
}

// Tree returns the curated Basiq-aligned AU category taxonomy.
// subClass codes match Basiq transaction enrichment (ANZSIC group level, e.g. "411").
// Leaf titles inferred from Hooli sandbox transactions in data/budget.db.
func Tree() []SeedNode {
	return []SeedNode{
		// Income (Basiq transaction classes — subClass empty; matched via class in sync)
		{SeedID: "inc-root", Name: "Income", Type: "income", Color: "#34d399", SortOrder: 0, System: true},
		{SeedID: "inc-salary", ParentSeedID: "inc-root", Name: "Salary & wages", Type: "income", Color: "#34d399", SortOrder: 0, System: true, BasiqSubClassCode: "direct-credit"},
		{SeedID: "inc-interest", ParentSeedID: "inc-root", Name: "Interest", Type: "income", Color: "#22c1c3", SortOrder: 1, BasiqSubClassCode: "interest"},
		{SeedID: "inc-refund", ParentSeedID: "inc-root", Name: "Refunds", Type: "income", Color: "#94a3b8", SortOrder: 2, BasiqSubClassCode: "refund"},

		// Transfer (subClass "0" on internal/salary transfers in sandbox data)
		{SeedID: "xfer-root", Name: "Transfers", Type: "transfer", Color: "#60a5fa", SortOrder: 1, System: true},
		{SeedID: "xfer-internal", ParentSeedID: "xfer-root", Name: "Internal transfer", Type: "transfer", Color: "#60a5fa", SortOrder: 0, System: true, BasiqSubClassCode: "0"},
		{SeedID: "xfer-class", ParentSeedID: "xfer-root", Name: "Transfer", Type: "transfer", Color: "#60a5fa", SortOrder: 1, System: true, BasiqSubClassCode: "transfer"},

		// Loan (class-only in sandbox — no subClass)
		{SeedID: "loan-root", Name: "Loan", Type: "expense", Color: "#64748b", SortOrder: 2, System: true},
		{SeedID: "loan-repay", ParentSeedID: "loan-root", Name: "Loan repayment", Type: "expense", Color: "#64748b", SortOrder: 0, System: true, BasiqSubClassCode: "loan-repayment"},
		{SeedID: "loan-int", ParentSeedID: "loan-root", Name: "Loan interest", Type: "expense", Color: "#64748b", SortOrder: 1, System: true, BasiqSubClassCode: "loan-interest"},

		// Expense groups (Basiq Consumer Affordability EXP-style parents)
		{SeedID: "exp-rent", Name: "Rent", Type: "expense", Color: "#7c5cff", SortOrder: 10, System: true},
		{SeedID: "exp-utilities", Name: "Utilities", Type: "expense", Color: "#7c5cff", SortOrder: 11, System: true},
		{SeedID: "exp-groc", Name: "Groceries", Type: "expense", Color: "#34d399", SortOrder: 12, System: true},
		{SeedID: "exp-retail", Name: "Retail", Type: "expense", Color: "#f5b942", SortOrder: 13, System: true},
		{SeedID: "exp-dining", Name: "Dining & takeaway", Type: "expense", Color: "#fb7185", SortOrder: 14, System: true},
		{SeedID: "exp-transport", Name: "Transport", Type: "expense", Color: "#a78bfa", SortOrder: 15, System: true},
		{SeedID: "exp-travel", Name: "Travel", Type: "expense", Color: "#38bdf8", SortOrder: 16, System: true},
		{SeedID: "exp-medical", Name: "Medical", Type: "expense", Color: "#ef4f6c", SortOrder: 17, System: true},
		{SeedID: "exp-insurance", Name: "Insurance", Type: "expense", Color: "#94a3b8", SortOrder: 18, System: true},
		{SeedID: "exp-subscriptions", Name: "Subscription media & software", Type: "expense", Color: "#e879f9", SortOrder: 19, System: true},
		{SeedID: "exp-fitness", Name: "Fitness & recreation", Type: "expense", Color: "#f97316", SortOrder: 20, System: true},
		{SeedID: "exp-gov", Name: "Government & rates", Type: "expense", Color: "#475569", SortOrder: 21, System: true},
		{SeedID: "exp-education", Name: "Education", Type: "expense", Color: "#818cf8", SortOrder: 22, System: true},
		{SeedID: "exp-auto", Name: "Vehicle & finance", Type: "expense", Color: "#cbd5e1", SortOrder: 23, System: true},
		{SeedID: "exp-fees", Name: "Bank fees", Type: "expense", Color: "#64748b", SortOrder: 24, System: true, BasiqSubClassCode: "bank-fee"},

		// Leaves from Hooli/Basiq sandbox (500 txns in data/budget.db)
		{SeedID: "leaf-263", ParentSeedID: "exp-utilities", Name: "Electricity supply", Type: "expense", Color: "#7c5cff", SortOrder: 0, BasiqSubClassCode: "263", AnzsicClassCode: "2630"},
		{SeedID: "leaf-281", ParentSeedID: "exp-utilities", Name: "Water supply", Type: "expense", Color: "#7c5cff", SortOrder: 1, BasiqSubClassCode: "281", AnzsicClassCode: "2811"},
		{SeedID: "leaf-400", ParentSeedID: "exp-transport", Name: "Petrol stations", Type: "expense", Color: "#a78bfa", SortOrder: 0, BasiqSubClassCode: "400", AnzsicClassCode: "4000"},
		{SeedID: "leaf-411", ParentSeedID: "exp-groc", Name: "Supermarkets and grocery stores", Type: "expense", Color: "#34d399", SortOrder: 0, BasiqSubClassCode: "411", AnzsicClassCode: "4110"},
		{SeedID: "leaf-412", ParentSeedID: "exp-groc", Name: "Specialised food retailing", Type: "expense", Color: "#34d399", SortOrder: 1, BasiqSubClassCode: "412", AnzsicClassCode: "4129"},
		{SeedID: "leaf-422", ParentSeedID: "exp-retail", Name: "Electrical and electronic goods", Type: "expense", Color: "#f5b942", SortOrder: 0, BasiqSubClassCode: "422", AnzsicClassCode: "4221"},
		{SeedID: "leaf-423", ParentSeedID: "exp-retail", Name: "Hardware and garden supplies", Type: "expense", Color: "#f5b942", SortOrder: 1, BasiqSubClassCode: "423", AnzsicClassCode: "4231"},
		{SeedID: "leaf-424", ParentSeedID: "exp-retail", Name: "Recreational goods", Type: "expense", Color: "#f5b942", SortOrder: 2, BasiqSubClassCode: "424", AnzsicClassCode: "4241"},
		{SeedID: "leaf-426", ParentSeedID: "exp-retail", Name: "Department stores", Type: "expense", Color: "#f5b942", SortOrder: 3, BasiqSubClassCode: "426", AnzsicClassCode: "4260"},
		{SeedID: "leaf-427", ParentSeedID: "exp-medical", Name: "Pharmacy and cosmetics", Type: "expense", Color: "#ef4f6c", SortOrder: 0, BasiqSubClassCode: "427", AnzsicClassCode: "4271"},
		{SeedID: "leaf-431", ParentSeedID: "exp-retail", Name: "Other store-based retail", Type: "expense", Color: "#f5b942", SortOrder: 4, BasiqSubClassCode: "431", AnzsicClassCode: "4310"},
		{SeedID: "leaf-451", ParentSeedID: "exp-dining", Name: "Cafes, restaurants and takeaway", Type: "expense", Color: "#fb7185", SortOrder: 0, BasiqSubClassCode: "451", AnzsicClassCode: "4511"},
		{SeedID: "leaf-452", ParentSeedID: "exp-dining", Name: "Pubs, taverns and bars", Type: "expense", Color: "#fb7185", SortOrder: 1, BasiqSubClassCode: "452", AnzsicClassCode: "4520"},
		{SeedID: "leaf-462", ParentSeedID: "exp-transport", Name: "Taxi and rideshare", Type: "expense", Color: "#a78bfa", SortOrder: 1, BasiqSubClassCode: "462", AnzsicClassCode: "4623"},
		{SeedID: "leaf-490", ParentSeedID: "exp-travel", Name: "Air transport", Type: "expense", Color: "#38bdf8", SortOrder: 0, BasiqSubClassCode: "490", AnzsicClassCode: "4900"},
		{SeedID: "leaf-542", ParentSeedID: "exp-subscriptions", Name: "Software and digital goods", Type: "expense", Color: "#e879f9", SortOrder: 0, BasiqSubClassCode: "542", AnzsicClassCode: "5420"},
		{SeedID: "leaf-562", ParentSeedID: "exp-subscriptions", Name: "Streaming and broadcast media", Type: "expense", Color: "#e879f9", SortOrder: 1, BasiqSubClassCode: "562", AnzsicClassCode: "5622"},
		{SeedID: "leaf-570", ParentSeedID: "exp-subscriptions", Name: "Music and audio subscriptions", Type: "expense", Color: "#e879f9", SortOrder: 2, BasiqSubClassCode: "570", AnzsicClassCode: "5700"},
		{SeedID: "leaf-580", ParentSeedID: "exp-utilities", Name: "Telecommunications", Type: "expense", Color: "#7c5cff", SortOrder: 2, BasiqSubClassCode: "580", AnzsicClassCode: "5801"},
		{SeedID: "leaf-623", ParentSeedID: "exp-auto", Name: "Motor vehicle finance", Type: "expense", Color: "#cbd5e1", SortOrder: 0, BasiqSubClassCode: "623", AnzsicClassCode: "6230"},
		{SeedID: "leaf-632", ParentSeedID: "exp-insurance", Name: "Insurance", Type: "expense", Color: "#94a3b8", SortOrder: 0, BasiqSubClassCode: "632", AnzsicClassCode: "6322"},
		{SeedID: "leaf-729", ParentSeedID: "exp-gov", Name: "Local government rates", Type: "expense", Color: "#475569", SortOrder: 0, BasiqSubClassCode: "729", AnzsicClassCode: "7291"},
		{SeedID: "leaf-751", ParentSeedID: "exp-gov", Name: "Taxation", Type: "expense", Color: "#475569", SortOrder: 1, BasiqSubClassCode: "751", AnzsicClassCode: "7510"},
		{SeedID: "leaf-772", ParentSeedID: "exp-auto", Name: "Vehicle registration and licensing", Type: "expense", Color: "#cbd5e1", SortOrder: 1, BasiqSubClassCode: "772", AnzsicClassCode: "7720"},
		{SeedID: "leaf-821", ParentSeedID: "exp-education", Name: "Education and training", Type: "expense", Color: "#818cf8", SortOrder: 0, BasiqSubClassCode: "821", AnzsicClassCode: "8211"},
		{SeedID: "leaf-859", ParentSeedID: "exp-medical", Name: "Medical services", Type: "expense", Color: "#ef4f6c", SortOrder: 1, BasiqSubClassCode: "859", AnzsicClassCode: "8599"},
		{SeedID: "leaf-911", ParentSeedID: "exp-fitness", Name: "Sports and recreation", Type: "expense", Color: "#f97316", SortOrder: 0, BasiqSubClassCode: "911", AnzsicClassCode: "9111"},
		{SeedID: "leaf-242", ParentSeedID: "exp-retail", Name: "Computer equipment", Type: "expense", Color: "#f5b942", SortOrder: 5, BasiqSubClassCode: "242", AnzsicClassCode: "2429"},
	}
}
