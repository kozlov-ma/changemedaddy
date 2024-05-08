package moex

import (
	"testing"
)

func TestParseTable(t *testing.T) {
	json := `{
		"columns": ["name", "age"],
		"data": [
			["Alice", 25],
			["Bob", 30]
		]
	}`

	table, err := parseTable(json)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(table) != 2 {
		t.Errorf("columns parsed incorrectly: want length %v, got %v", 2, len(table))
	}

	if len(table["name"]) != 2 {
		t.Errorf("name column parsed incorrectly: want length %v, got %v", 2, len(table["name"]))
	}

	if len(table["age"]) != 2 {
		t.Errorf("age column parsed incorrectly: want length %v, got %v", 2, len(table["age"]))
	}

	expected := map[string][]string{
		"name": {"Alice", "Bob"},
		"age":  {"25", "30"},
	}

	for col, vals := range expected {
		for i, val := range vals {
			if table[col][i] != val {
				t.Errorf("unexpected value in column %q at index %v: want %q, got %q", col, i, val, table[col][i])
			}
		}
	}
}
