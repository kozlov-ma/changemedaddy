package idea

import (
	"changemedaddy/internal/model"
	"time"

	"github.com/shopspring/decimal"
)

type (
	CreatePositionRequest struct {
		Ticker      string             `json:"ticker"`
		Type        model.PositionType `json:"type"`
		StartPrice  decimal.Decimal    `json:"start_price"`
		TargetPrice decimal.Decimal    `json:"target_price"`
		IdeaPart    int                `json:"idea_part"`
	}

	CreateIdeaRequest struct {
		Name       string                  `json:"name"`
		Positions  []CreatePositionRequest `json:"positions"`
		Deadline   time.Time               `json:"deadline"`
		SourceLink string                  `json:"source_link"`
	}

	FindRequest struct {
		ID   int    `json:"id,omitempty"`
		Slug string `json:"slug,omitempty"`
	}
)
