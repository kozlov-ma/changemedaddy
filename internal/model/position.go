package model

import (
	"github.com/shopspring/decimal"
)

type (
	PositionType string

	PositionStatus string

	Position struct {
		ID          int
		Ticker      string
		Type        PositionType
		Status      PositionStatus
		StartPrice  decimal.Decimal
		TargetPrice decimal.Decimal
		IdeaPart    decimal.Decimal
	}
)

const (
	PositionLong  PositionType = "long"
	PositionShort PositionType = "short"
)

const (
	StatusActive PositionStatus = "active"
	StatusClosed PositionStatus = "closed"
)
