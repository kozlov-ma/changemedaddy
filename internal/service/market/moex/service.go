package moex

import "net/http"

type moex struct {
	client *http.Client
}
