package invest

import "time"

type PositionStatus int

const (
	StatusOpen PositionStatus = iota + 1
	StatusClosed
)

type InstrumentType int

const (
	TypeShares InstrumentType = iota + 1
	TypeFutures
)

type PositionKind int

const (
	KindLong PositionKind = iota + 1
	KindShort
)

type Position struct {
	Ticker         string
	Kind           PositionKind
	InstrumentType InstrumentType
	RelAmount      int
	StartPrice     float64
	TargetPrice    float64
	Log            []PositionChange
}

func (p Position) Status() PositionStatus {
	if p.RelAmount == 0 {
		return StatusClosed
	}

	return StatusOpen
}

type PositionChange interface {
	When() time.Time
	Apply(Position) Position
}

type TargetPriceChange struct {
	NewTargetPrice float64
}

type AmountChange struct {
	Delta int
	Price float64
}
