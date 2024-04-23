package fixable

import (
	"net/http"

	"github.com/go-chi/render"
)

type Error struct {
	Err      error          `json:"-"`
	AppCode  AppCode        `json:"app_code"`
	HTTPCode int            `json:"-"`
	Fixes    map[FixKey]Fix `json:"fixes"`
}

func (e *Error) Render(r *http.Request) error {
	render.Status(r, e.HTTPCode)
	return nil
}

func (e *Error) Error() string {
	return e.Err.Error()
}
