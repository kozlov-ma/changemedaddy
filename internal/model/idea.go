package model

import (
	"time"
)

type (
	Idea struct {
		ID   int
		Slug string

		Positions []Position

		SourceLink string

		Deadline time.Time
		OpenDate time.Time
	}
)
