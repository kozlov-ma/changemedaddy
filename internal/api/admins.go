package api

import (
	"changemedaddy/internal/aggregate/analyst"
	"changemedaddy/internal/aggregate/idea"
	"changemedaddy/internal/domain/position"
	"errors"
	"fmt"
	"time"

	"github.com/greatcloak/decimal"
	"github.com/labstack/echo/v4"
)

func (h *handler) adminMW(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		a, err := c.Cookie("is_admin")
		if err != nil || a == nil {
			writeCookie(c, "is_admin", "false")
			c.Set("is_admin", false)
			return next(c)
		}
		if a.Value == "true" {
			writeCookie(c, "is_admin", "иди нахуй")
			c.Set("is_admin", false)
			return next(c)
		}
		if a.Value != "pavel shemetov, fuck me~" {
			writeCookie(c, "is_admin", "false")
			c.Set("is_admin", false)
			return next(c)
		}

		c.Set("is_admin", true)

		return next(c)
	}
}

func (h *handler) adminonlyMW(next echo.HandlerFunc) echo.HandlerFunc {
	return func(c echo.Context) error {
		isAdmin, _ := c.Get("is_admin").(bool)
		if !isAdmin {
			return c.Redirect(307, "/401")
		}

		return next(c)
	}
}

func (h *handler) makeAdmin(c echo.Context) error {
	if c.Param("password") == "k4k4y4_5p1d_app" {
		writeCookie(c, "is_admin", "pavel shemetov, fuck me~")
		return c.String(200, "Course{sp3rma}")
	}

	return c.Redirect(307, "https://cp.beget.com/shared/Dyzmia-zY3oLclceXSit1AebJt54ariX/joomla3.png")
}

func (h *handler) fakeMeData(c echo.Context) error {
	ctx := c.Request().Context()
	var e error
	func() {
		err := h.as.RegisterAs(ctx, "mk0101", "MK")
		if err != nil {
			e = errors.Join(err)
		}

		h.as.RegisterAs(ctx, "shemet-no-lifer", "Павел Шеметов")
		h.as.RegisterAs(ctx, "d1sturm", "Иван Домашних")
	}()

	fakeMeIdeas := func() {
		an, err := h.as.Auth(ctx, "mk0101")
		if err != nil {
			e = errors.Join(err, e)
		}

		// fake mgnt
		func() {
			i, err := an.NewIdea(ctx, h.ir, analyst.IdeaCreationOptions{
				Name: "Магнит 🚀🌕",
			})
			if err != nil {
				e = errors.Join(err, e)
			}

			p, err := i.NewPosition(ctx, h.mp, h.pos, h.ir, position.CreationOptions{
				Ticker:      "MGNT",
				Type:        position.Long,
				TargetPrice: "11000",
				Deadline:    "31.05.2024",
			})
			if err != nil {
				e = errors.Join(err, e)
			}

			p.OpenDate = time.Date(2024, time.March, 10, 13, 31, 32, 0, time.Local)
			p.OpenPrice = decimal.NewFromInt(7841)
			if err := h.pos.Update(ctx, p); err != nil {
				e = errors.Join(err, e)
			}
		}()

		// fake sofl
		func() {
			i, err := an.NewIdea(ctx, h.ir, analyst.IdeaCreationOptions{
				Name: "Софтлайн -> деньги",
			})
			if err != nil {
				e = errors.Join(err, e)
				h.log.Error("failed to fake data", "err", err)
			}

			p, err := i.NewPosition(ctx, h.mp, h.pos, h.ir, position.CreationOptions{
				Ticker:      "SOFL",
				Type:        position.Long,
				TargetPrice: "200",
				Deadline:    "15.06.2024",
			})
			if err != nil {
				e = errors.Join(err, e)
				h.log.Error("failed to fake data", "err", err)
			}

			p.OpenDate = time.Date(2024, time.April, 29, 13, 31, 32, 0, time.Local)
			p.OpenPrice = decimal.NewFromFloat(173.45)
			if err := h.pos.Update(ctx, p); err != nil {
				e = errors.Join(err, e)
				h.log.Error("failed to fake data", "err", err)
			}
		}()

		// fake yndx
		func() {
			i, err := an.NewIdea(ctx, h.ir, analyst.IdeaCreationOptions{
				Name: "Скоро в Россию!",
			})
			if err != nil {
				e = errors.Join(err, e)
				h.log.Error("failed to fake data", "err", err)
			}

			p, err := i.NewPosition(ctx, h.mp, h.pos, h.ir, position.CreationOptions{
				Ticker:      "YNDX",
				Type:        position.Long,
				TargetPrice: "10000",
				Deadline:    "20.04.2025",
			})
			if err != nil {
				e = errors.Join(err, e)
				h.log.Error("failed to fake data", "err", err)
			}
			p.TargetPrice = decimal.NewFromFloat(4000)
			p.OpenDate = time.Date(2023, time.December, 4, 13, 31, 32, 0, time.Local)
			p.OpenPrice = decimal.NewFromFloat(2387)
			p.ClosedPrice = decimal.NewFromFloat(3933.4)
			p.Deadline = time.Date(2024, time.March, 25, 0, 0, 0, 0, time.Local)
			p.Status = position.Closed

			if err := h.pos.Update(ctx, p); err != nil {
				e = errors.Join(err, e)
				h.log.Error("failed to fake data", "err", err)
			}

			i.Status = idea.Closed
			if err := h.ir.Update(ctx, i); err != nil {
				e = errors.Join(err, e)
				h.log.Error("failed to fake data", "err", err)
			}
		}()
	}

	if e != nil {
		return e
	}

	fakeMeIdeas()

	return c.String(200, "very good")
}

func (h *handler) regToken(c echo.Context) error {
	ctx := c.Request().Context()
	token := c.Param("token")
	if token == "" {
		return c.String(400, "no token")
	}

	forName := c.Param("forName")
	if forName == "" {
		return c.String(400, "no forName")
	}

	err := h.as.RegisterAs(ctx, token, forName)
	if err != nil {
		h.log.Error("failed to register as", "err", err)
		return c.String(500, err.Error())
	}

	return c.String(200, fmt.Sprintf("https://idea-x3.ru/token_auth/%s", token))
}
