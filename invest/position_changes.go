package invest

import (
	"math"
	"time"
)

type TargetPriceChange struct {
	Time           time.Time `validate:"required"`
	NewTargetPrice float64   `validate:"required,gt=0"`
}

func (t TargetPriceChange) Type() string {
	return "target_price"
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
	if err := baseCheck(p, t); err != nil {
		return err
	}

	if t.NewTargetPrice <= 0 {
		return InvalidTargetPrice
	}

	return nil
}

type AmountChange struct {
	Time  time.Time `validate:"required"`
	Delta int       `validate:"required"`
	Price float64   `validate:"required,gt=0"`
}

func (a AmountChange) Type() string {
	return "amount"
}

func (a AmountChange) When() time.Time {
	return a.Time
}

func (a AmountChange) Apply(position Position) Position {
	p := position

	newAmount := p.RelAmount + a.Delta

	if abs(newAmount) < abs(p.RelAmount) {
		profitP := (math.Abs(float64(a.Delta)) * (a.Price - p.StartPrice)) / (math.Abs(float64(p.RelAmount) * p.StartPrice)) * 100
		p.FixedProfitP += profitP
	} else {
		newPrice := (p.StartPrice*math.Abs(float64(p.RelAmount)) + a.Price*math.Abs(float64(a.Delta))) / math.Abs(float64(newAmount))
		p.StartPrice = newPrice
	}

	p.RelAmount = newAmount
	p.Log = append(p.Log, a)

	return p
}

func (a AmountChange) Check(p Position) error {
	if err := baseCheck(p, a); err != nil {
		return err
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

type DeadlineChange struct {
	Time        time.Time `validate:"required"`
	NewDeadline time.Time `validate:"required,nefield=Time"`
}

func (d DeadlineChange) Type() string {
	return "deadline"
}

func (d DeadlineChange) Apply(p Position) Position {
	p.Log = append(p.Log, d)
	p.Deadline = d.NewDeadline

	return p
}

func (d DeadlineChange) When() time.Time {
	return d.Time
}

func (d DeadlineChange) Check(p Position) error {
	if err := baseCheck(p, d); err != nil {
		return err
	}

	if time.Since(d.NewDeadline).Hours() >= 24 {
		return InvalidDeadline
	}

	return nil
}

func abs(x int) int {
	if x < 0 {
		return -x
	}

	return x
}
