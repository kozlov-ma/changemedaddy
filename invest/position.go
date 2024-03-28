package invest

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
	FixedProfitP   float64
	Log            []PositionChange
}

func (p Position) Status() PositionStatus {
	if p.RelAmount == 0 {
		return StatusClosed
	}

	return StatusOpen
}
