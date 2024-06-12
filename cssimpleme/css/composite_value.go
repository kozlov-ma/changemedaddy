package css

type CompositeReader struct {
	readers []ValueReader
}

func NewCompositeReader(readers ...ValueReader) *CompositeReader {
	return &CompositeReader{
		readers: readers,
	}
}

func (c *CompositeReader) Read(fromCls string) (processed string, ok bool) {
	for _, r := range c.readers {
		processed, ok = r.Read(fromCls)
		if ok {
			return processed, ok
		}
	}

	return "", false
}
