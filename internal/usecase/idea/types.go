package idea

import (
	"changemedaddy/internal/domain/idea"
	"changemedaddy/internal/domain/position"
	"time"

	"github.com/shopspring/decimal"
)

type (
	CreatePositionRequest struct {
		Ticker      string          `json:"ticker"`
		Type        position.Type   `json:"type"`
		StartPrice  decimal.Decimal `json:"start_price"`
		TargetPrice decimal.Decimal `json:"target_price"`
		IdeaPart    int             `json:"idea_part"`
	}

	CreateIdeaRequest struct {
		Name          string                  `json:"name"`
		CreatedBySlug string                  `json:"created_by_slug"`
		Positions     []CreatePositionRequest `json:"positions"`
		Deadline      time.Time               `json:"deadline"`
		SourceLink    string                  `json:"source_link"`
	}

	FindRequest struct {
		Slug          string `json:"slug,omitempty"`
		CreatedBySlug string `json:"created_by_slug,omitempty"`
	}

	IdeaResponse struct {
		*idea.Idea
		Positions []PositionResponse
		ProfitP   decimal.Decimal
	}

	PositionResponse struct {
		*position.Position
		ProfitP  decimal.Decimal
		CurPrice decimal.Decimal
	}
)
