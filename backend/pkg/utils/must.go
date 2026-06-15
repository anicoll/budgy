package utils

// Must takes a value and an error. If the error is non-nil, it panics.
// Otherwise, it returns the value.
func Must[T any](val T, err error) T {
	if err != nil {
		panic(err)
	}
	return val
}
