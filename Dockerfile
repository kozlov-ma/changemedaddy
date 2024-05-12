FROM golang:1.22.3-alpine3.18

WORKDIR ../changemedaddy

COPY go.mod .
COPY go.sum .

CMD go mod download

COPY . .