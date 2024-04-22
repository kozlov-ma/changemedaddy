package model

import (
	"time"

	"github.com/shopspring/decimal"
)

type (
	Candle struct {
		Open, High, Low, Close decimal.Decimal
		Time                   time.Time
	}
)
