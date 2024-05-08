package moex

import (
	"changemedaddy/internal/domain/instrument"
	"errors"
	"fmt"

	"github.com/tidwall/gjson"
)

var (
	errNoColumns = errors.New("no columns")
	errNoData    = errors.New("no data")
)

type table struct {
	NRows   int
	ColVals map[string][]string
}

func parseTable(json string) (*table, error) {
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

	data, err := func() ([][]string, error) {
		dd := gjson.Get(json, "data")
		if !dd.Exists() {
			return nil, errNoData
		}

		var data [][]string
		for _, rr := range dd.Array() {
			var row []string
			for _, cell := range rr.Array() {
				row = append(row, cell.String())
			}
			data = append(data, row)
		}

		return data, nil
	}()
	if err != nil {
		return nil, fmt.Errorf("couldn't parse data: %w", err)
	}

	tab := &table{
		ColVals: make(map[string][]string),
	}
	for _, row := range data {
		if len(row) != len(columns) {
			return nil, fmt.Errorf("row has %d columns, but there are %d columns", len(row), len(columns))
		}
		for i, col := range columns {
			tab.ColVals[col] = append(tab.ColVals[col], row[i])
		}
	}

	tab.NRows = len(data)
	return tab, nil
}

func instruments(t *table) ([]*instrument.Instrument, error) {
	instr := make([]*instrument.Instrument, t.NRows)
	for i := range instr {
		instr[i] = &instrument.Instrument{
			Name:   t.ColVals["BOARDNAME"][i],
			Ticker: t.ColVals["SECID"][i],
		}
	}
	return instr, nil
}
