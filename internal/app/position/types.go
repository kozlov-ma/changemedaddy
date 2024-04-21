package position

import (
	"go/types"
	"time"

	"github.com/shopspring/decimal"
)

type (
	CreateRequest struct {
		Name         string          `json:"name"`
		CreatedById  int             `json:"created_by_id"`
		IdeaLink     string          `json:"idea_link"`
		TargetPrice  decimal.Decimal `json:"targetPrice"`
		FixedProfitP decimal.Decimal `json:"fixed_profit_p"`
		CreatedAt    time.Time       `json:"createdAt"`
		Deadline     time.Time       `json:"deadline"`

		Ticker    string          `json:"ticker"`
		Type      types.Type      `json:"type"`
		OpenPrice decimal.Decimal `json:"open_price"`
		Amount    int             `json:"amount"`
	}
)
