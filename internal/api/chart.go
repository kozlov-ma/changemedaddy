package api

import (
	"changemedaddy/internal/domain/chart"
	"encoding/json"
	"github.com/labstack/echo/v4"
	"net/http"
	"time"
)

func (h *handler) getChartData(c echo.Context) error {
	ctx := c.Request().Context()

	ticker := c.Param("ticker")
	openedAt, err := time.Parse(chart.DateFormat, c.Param("openedAt"))
	if err != nil {
		_ = c.Blob(http.StatusBadRequest, "application/json", []byte{})
		return err
	}
	deadline, err := time.Parse(chart.DateFormat, c.Param("deadline"))
	if err != nil {
		_ = c.Blob(http.StatusBadRequest, "application/json", []byte{})
		return err
	}
	i, err := h.mp.Find(ctx, ticker)
	if err != nil {
		_ = c.Blob(http.StatusBadRequest, "application/json", []byte{})
		return err
	}
	interval, err := i.WithInterval(ctx, openedAt, deadline)
	if err != nil {
		_ = c.Blob(http.StatusBadRequest, "application/json", []byte{})
		return err
	}

	candles, err := h.mp.GetCandles(ctx, &interval)
	if err != nil {
		_ = c.Blob(http.StatusInternalServerError, "application/json", []byte{})
		return err
	}
	jsonData, err := json.Marshal(candles)
	if err != nil {
		_ = c.Blob(http.StatusInternalServerError, "application/json", jsonData)
		return err
	}
	return c.Blob(http.StatusOK, "application/json", jsonData)
}
