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

	tab, err := parseTable(json)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(tab.ColVals) != 2 {
		t.Errorf("columns parsed incorrectly: want length %v, got %v", 2, len(tab.ColVals))
	}

	if tab.NRows != 2 {
		t.Errorf("rows parsed incorrectly: want %v, got %v", 2, tab.NRows)
	}

	if len(tab.ColVals["name"]) != 2 {
		t.Errorf("name column parsed incorrectly: want length %v, got %v", 2, len(tab.ColVals["name"]))
	}

	if len(tab.ColVals["age"]) != 2 {
		t.Errorf("age column parsed incorrectly: want length %v, got %v", 2, len(tab.ColVals["age"]))
	}

	expected := map[string][]string{
		"name": {"Alice", "Bob"},
		"age":  {"25", "30"},
	}

	for col, vals := range expected {
		for i, val := range vals {
			if tab.ColVals[col][i] != val {
				t.Errorf("unexpected value in column %q at index %v: want %q, got %q", col, i, val, tab.ColVals[col][i])
			}
		}
	}
}
