package assert

func That(truth bool, msg string) {
	if !truth {
		panic(msg)
	}
}
