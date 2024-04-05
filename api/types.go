package api

import (
	"changemedaddy/invest"
	"github.com/go-playground/validator/v10"
	"net/http"
	"strings"
	"time"
)

var (
	validate = validator.New(validator.WithRequiredStructEnabled())
)

type PositionResponse struct {
	ID             int64
	Ticker         string
	Kind           invest.PositionKind
	InstrumentType invest.InstrumentType
	RelAmount      int
	CurPrice       float64
	StartPrice     float64
	TargetPrice    float64
	FixedProfitP   float64
	Start          time.Time
	Deadline       time.Time
	Log            []ChangeResponse
}

func (api API) NewPositionResponse(id int64, pos *invest.Position, curPrice float64) *PositionResponse {
	log := make([]ChangeResponse, len(pos.Log))
	for i, l := range pos.Log {
		log[i] = NewChangeResponse(l)
	}

	return &PositionResponse{
		ID:             id,
		Ticker:         pos.Ticker,
		Kind:           pos.Kind,
		InstrumentType: pos.InstrumentType,
		RelAmount:      pos.RelAmount,
		CurPrice:       curPrice,
		StartPrice:     pos.StartPrice,
		TargetPrice:    pos.TargetPrice,
		FixedProfitP:   pos.FixedProfitP,
		Start:          pos.Start,
		Deadline:       pos.Deadline,
		Log:            log,
	}
}

func (pr *PositionResponse) Render(w http.ResponseWriter, r *http.Request) error {
	return nil
}

type PositionRequest struct {
	Ticker         string                `validate:"required,min=1,max=12"`
	Kind           invest.PositionKind   `validate:"required,oneof=1 2"`
	InstrumentType invest.InstrumentType `validate:"required,oneof=1 2"`
	RelAmount      int
	StartPrice     float64   `validate:"required,gt=0"`
	TargetPrice    float64   `validate:"required,gt=0"`
	Start          time.Time `validate:"required"`
	Deadline       time.Time `validate:"required"`
}

func (p *PositionRequest) Bind(r *http.Request) error {
	p.Ticker = strings.ToUpper(p.Ticker)

	if err := validate.Struct(p); err != nil {
		return err
	}

	return nil
}

func (p *PositionRequest) ToPosition() invest.Position {
	return invest.Position{
		Ticker:         p.Ticker,
		Kind:           p.Kind,
		InstrumentType: p.InstrumentType,
		RelAmount:      p.RelAmount,
		StartPrice:     p.StartPrice,
		TargetPrice:    p.TargetPrice,
		FixedProfitP:   0,
		Start:          p.Start,
		Deadline:       p.Deadline,
		Log:            nil,
	}
}

type ChangeResponse struct {
	Type   string
	Change invest.PositionChange
}

func NewChangeResponse(change invest.PositionChange) ChangeResponse {
	return ChangeResponse{
		Type:   change.Type(),
		Change: change,
	}
}
