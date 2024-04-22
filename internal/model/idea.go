package model

import (
	"time"
)

type (
	Idea struct {
		ID   int
		Slug string

		CreatedBy    Analyst
		Position     Position
		PositionInfo PositionInfo

		Deadline time.Time
	}
)
