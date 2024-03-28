package invest

import "time"

var minChangeTime = time.Date(2024, time.March, 28, 19, 31, 0, 0, time.FixedZone("UTC-5", 0))

type PositionChange interface {
	When() time.Time
	Apply(Position) Position
	Check(Position) error
}

type TargetPriceChange struct {
	Time           time.Time
	NewTargetPrice float64
}

func (t TargetPriceChange) When() time.Time {
	return t.Time
}

func (t TargetPriceChange) Apply(position Position) Position {
	p := position

	p.TargetPrice = t.NewTargetPrice
	p.Log = append(p.Log, t)

	return p
}

func (t TargetPriceChange) Check(p Position) error {
	if p.Status() == StatusClosed {
		return CannotChangeClosedPosition
	}

	if t.Time.Before(minChangeTime) {
		return InvalidChangeTime
	}

	if t.NewTargetPrice <= 0 {
		return InvalidTargetPrice
	}

	return nil
}

type AmountChange struct {
	Time  time.Time
	Delta int
	Price float64
}

func (a AmountChange) When() time.Time {
	return a.Time
}

func (a AmountChange) Apply(position Position) Position {
	p := position

	newAmount := p.RelAmount + a.Delta
	newPrice := (p.StartPrice*float64(p.RelAmount) + a.Price*float64(a.Delta)) / float64(newAmount)

	p.RelAmount = newAmount
	p.StartPrice = newPrice

	if abs(newAmount) < abs(p.RelAmount) {
		profitP := (float64(a.Delta) * a.Price / float64(p.RelAmount) * p.StartPrice) * 100
		p.FixedProfitP += profitP
	}

	p.Log = append(p.Log, a)

	return p
}

func (a AmountChange) Check(p Position) error {
	if p.Status() == StatusClosed {
		return CannotChangeClosedPosition
	}

	if a.Time.Before(minChangeTime) {
		return InvalidChangeTime
	}

	if a.Price <= 0 {
		return InvalidPrice
	}

	if a.Delta == 0 {
		return ZeroDeltaError
	}

	// If delta will lead to a short position being converted to long.
	if p.RelAmount < 0 && a.Delta > (-p.RelAmount) {
		return TooBigAbsDelta
	}

	// If delta will lead to a long position being converted to short.
	if p.RelAmount > 0 && a.Delta < (-p.RelAmount) {
		return TooBigAbsDelta
	}

	return nil
}

func abs(x int) int {
	if x < 0 {
		return -x
	}

	return x
}
