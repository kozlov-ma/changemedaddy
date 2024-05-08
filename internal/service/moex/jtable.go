package moex

import (
	"errors"
	"fmt"

	"github.com/tidwall/gjson"
)

var (
	errNoColumns = errors.New("no columns")
	errNoData    = errors.New("no data")
)

func parseTable(json string) (map[string][]string, error) {
	columns, err := func() ([]string, error) {
		cols := gjson.Get(json, "columns")
		if !cols.Exists() {
			return nil, errNoColumns
		}

		var columns []string
		for _, col := range cols.Array() {
			columns = append(columns, col.String())
		}

		return columns, nil
	}()
	if err != nil {
		return nil, fmt.Errorf("couldn't parse columns: %w", err)
	}

	data := gjson.Get(json, "data")
	if !data.Exists() {
		return nil, errNoData
	}

	table := make(map[string][]string)
	for _, rr := range data.Array() {
		row := rr.Array()
		if len(row) != len(columns) {
			return nil, fmt.Errorf("row has %d columns, but there are %d columns", len(row), len(columns))
		}
		for i, col := range columns {
			table[col] = append(table[col], row[i].String())
		}
	}

	return table, nil
}
