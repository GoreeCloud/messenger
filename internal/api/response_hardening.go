// SPDX-License-Identifier: AGPL-3.0-only

package api

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

// writeAccepted emits a bodyless successful mutation response with the same
// privacy and content-sniffing protections used by JSON API responses.
func writeAccepted(w http.ResponseWriter) {
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusAccepted)
}

// hasUnexpectedTrailingJSON reports whether a decoded request contains any
// non-whitespace bytes after its first JSON value. Both additional valid values
// and malformed trailing content fail closed instead of being silently ignored.
func hasUnexpectedTrailingJSON(decoder *json.Decoder) bool {
	var trailing any
	return !errors.Is(decoder.Decode(&trailing), io.EOF)
}
