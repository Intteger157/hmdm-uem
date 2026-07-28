//go:build windows

package terminal

import "testing"

type stubResizeTarget struct {
	cols int
	rows int
}

func (s *stubResizeTarget) Resize(width, height int) error {
	s.cols = width
	s.rows = height
	return nil
}

func TestTryHandleControlMessageResize(t *testing.T) {
	t.Parallel()

	target := &stubResizeTarget{}
	if !tryHandleControlMessage(target, []byte(`{"type":"resize","cols":120,"rows":30}`)) {
		t.Fatal("expected resize message to be handled")
	}
	if target.cols != 120 || target.rows != 30 {
		t.Fatalf("unexpected size: %dx%d", target.cols, target.rows)
	}
}

func TestTryHandleControlMessageIgnoresInput(t *testing.T) {
	t.Parallel()

	target := &stubResizeTarget{}
	if tryHandleControlMessage(target, []byte("hostname\r")) {
		t.Fatal("expected shell input to pass through")
	}
}
