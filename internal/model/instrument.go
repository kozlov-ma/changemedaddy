package model

import "github.com/shopspring/decimal"

type Instrument struct {
	Name     string
	Ticker   string
	CurPrice decimal.Decimal
}
