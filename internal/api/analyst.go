package api

import (
	"changemedaddy/internal/aggregate/analyst"
	"changemedaddy/internal/ui"
	"errors"
	"strconv"

	"github.com/labstack/echo/v4"
)

func (h *handler) analystMiddleware(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		var a *analyst.Analyst

		idS := c.Param("analystID")
		if idS != "" {
			id, err := strconv.Atoi(idS)
			if err != nil {
				h.log.Debug("tried to get analyst with wrong id", "id", id, "err", err)
				ui.Render404(c)
				return err
			}

			an, err := h.ar.Find(c.Request().Context(), id)
			if errors.Is(err, analyst.ErrNotFound) {
				h.log.Debug("couldn't find analyst: given id does not exist", "id", id)
				ui.Render404(c)
				return err
			} else if err != nil {
				h.log.Error("couldn't find analyst", "id", id, "err", err)
				ui.Render500(c)
				return err
			}
			a = an
		}

		slug := c.Param("analystSlug")
		if slug != "" {
			an, err := h.ar.FindBySlug(c.Request().Context(), slug)
			if errors.Is(err, analyst.ErrNotFound) {
				h.log.Debug("couldn't find analyst: given slug does not exist", "slug", slug)
				ui.Render404(c)
				return err
			} else if err != nil {
				h.log.Error("couldn't find analyst", "slug", slug, "err", err)
				ui.Render500(c)
				return err
			}
			a = an
		}

		c.Set("analyst", a)
		return next(c)
	}
}

func (h *handler) register(c echo.Context) error {
	return ui.NewAnalyst().Render(c)
}

func (h *handler) newAnalyst(c echo.Context) error {
	var co analyst.CreationOptions
	if err := c.Bind(&co); err != nil {
		h.log.Warn("couldn't bind analyst creation options", "err", err)
		ui.Render400(c)
		return err
	}

	a, err := analyst.New(c.Request().Context(), h.ar, co)
	if errors.Is(err, analyst.ErrNameTooShort) || errors.Is(err, analyst.ErrNameTooLong) || errors.Is(err, analyst.ErrDuplicateName) {
		return ui.AnalystForm{
			PrevName:     co.Name,
			NameTooLong:  errors.Is(err, analyst.ErrNameTooLong),
			NameTooShort: errors.Is(err, analyst.ErrNameTooShort),
			NameTaken:    errors.Is(err, analyst.ErrDuplicateName),
		}.Render(c)
	} else if err != nil {
		h.log.Error("couldn't create analyst", "err", err)
		ui.Render500(c)
		return err
	}

	ideas, err := a.Ideas(c.Request().Context(), h.ir)
	if err != nil {
		h.log.Error("couldn't create position", "err", err)
		ui.Render500(c)
		return err
	}

	return ui.Analyst(a, ideas).Render(c)
}

func (h *handler) getAnalyst(c echo.Context) error {
	a := c.Get("analyst").(*analyst.Analyst)
	if a == nil {
		return ui.Render404(c)
	}

	ideas, err := a.Ideas(c.Request().Context(), h.ir)
	if err != nil {
		h.log.Error("couldn't create position", "err", err)
		ui.Render500(c)
		return err
	}

	return ui.Analyst(a, ideas).Render(c)
}
