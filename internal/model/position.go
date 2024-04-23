package model

import (
	"time"

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
		AvgPrice    decimal.Decimal
		TargetPrice decimal.Decimal
		IdeaPart    decimal.Decimal
		OpenDate    time.Time
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
