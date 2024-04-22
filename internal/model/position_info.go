package model

import "github.com/shopspring/decimal"

type (
	PositionInfo struct {
		CurPrice   decimal.Decimal
		ClosePrice decimal.Decimal
	}
)
