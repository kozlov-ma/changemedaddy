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
	ID             int64
	Status         PositionStatus
	Ticker         string
	InstrumentType InstrumentType
	PositionKind   PositionKind
	StartPrice     float64
	TargetPrice    float64
}
