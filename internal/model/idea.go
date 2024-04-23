package model

import (
	"time"
)

type (
	Idea struct {
		ID   int
		Slug string

		Positions []Position

		Deadline time.Time
	}
)
