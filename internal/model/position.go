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
		Ticker      string
		AvgPrice    decimal.Decimal
		TargetPrice decimal.Decimal
		OpenDate    time.Time
	}
)

const (
	PositionLong  PositionType = "long"
	PositionShort PositionType = "short"
)

const (
	PositionActive PositionStatus = "active"
	PositionClosed PositionStatus = "closed"
)
