package timeext

import "time"

func Min(time1 time.Time, time2 time.Time) time.Time {
	if time1.Before(time2) {
		return time1
	} else {
		return time2
	}
}
