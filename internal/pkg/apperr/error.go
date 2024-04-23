package apperr

import (
	"net/http"

	"github.com/go-chi/render"
)

type Fix struct {
	name  string
	value any
}

type Error struct {
	Err      error  `json:"-"`
	AppCode  string `json:"app_code"`
	HTTPCode int    `json:"-"`
	Fixes    []Fix  `json:"fixes"`
}

func (e *Error) Render(r *http.Request) error {
	render.Status(r, e.HTTPCode)
	return nil
}

func (e *Error) Error() string {
	return e.Err.Error()
}
