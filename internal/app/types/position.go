package types

import (
	"slices"
	"time"

	"github.com/shopspring/decimal"
)

type (
	Type string

	Lot struct {
		OpenDate time.Time
		Amount   int
		Price    decimal.Decimal
	}

	Position struct {
		ID            int             `json:"id" bson:"_id"`
		CreatedByName string          `json:"created_by_name"`
		IdeaLink      string          `json:"idea_link"`
		Ticker        string          `json:"ticker"`
		Type          Type            `json:"type"`
		TargetPrice   decimal.Decimal `json:"targetPrice"`
		Lots          []Lot           `json:"lots"`
		FixedProfitP  decimal.Decimal `json:"fixed_profit_p"`
		CreatedAt     time.Time       `json:"createdAt"`
		Deadline      time.Time       `json:"deadline"`
	}
)

const (
	Long  Type = "long"
	Short Type = "short"
)

func (p *Position) Clone() *Position {
	if p == nil {
		return nil
	}

	copied := *p
	cpy := &copied
	cpy.Lots = slices.Clone(p.Lots)
	return cpy
}
