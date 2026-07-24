package metadata

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"io"
	"os"
	"strings"

	"github.com/richardlehane/mscfb"
)

func parseMsiMetadataFromTables(path string) (InstallerMetadata, error) {
	file, err := os.Open(path)
	if err != nil {
		return InstallerMetadata{}, err
	}
	defer file.Close()

	doc, err := mscfb.New(file)
	if err != nil {
		return InstallerMetadata{}, err
	}

	targetedTables := map[string][]byte{
		"Table._StringData": nil,
		"Table._StringPool": nil,
		"Table._Columns":    nil,
		"Table.Property":    nil,
	}

	for entry, err := doc.Next(); err == nil; entry, err = doc.Next() {
		name := msiDecodeStreamName(entry.Name)
		if _, ok := targetedTables[name]; !ok {
			continue
		}
		data, readErr := readEntryData(entry)
		if readErr != nil {
			return InstallerMetadata{}, fmt.Errorf("read msi stream %q: %w", name, readErr)
		}
		targetedTables[name] = data
	}

	for tableName, data := range targetedTables {
		if len(data) == 0 {
			return InstallerMetadata{}, fmt.Errorf("table %s not found in msi", tableName)
		}
	}

	allStrings, err := decodeMsiStrings(targetedTables["Table._StringData"], targetedTables["Table._StringPool"])
	if err != nil {
		return InstallerMetadata{}, err
	}

	propTable, err := decodeMsiPropertyTableColumns(targetedTables["Table._Columns"], allStrings)
	if err != nil {
		return InstallerMetadata{}, err
	}

	props, err := decodeMsiPropertyTable(targetedTables["Table.Property"], propTable, allStrings)
	if err != nil {
		return InstallerMetadata{}, err
	}

	return InstallerMetadata{
		Name:    strings.TrimSpace(props["ProductName"]),
		Version: NormalizeVersion(props["ProductVersion"]),
	}, nil
}

type msiTable struct {
	Name string
	Cols []msiColumn
}

type msiColumn struct {
	Number     int
	Name       string
	Attributes uint16
}

type msiType uint16

const (
	msiString           msiType = 0xD00
	msiStringLocalized  msiType = 0xF00
)

func (column msiColumn) Type() msiType {
	if column.Attributes&0x0F00 < 0x800 {
		return msiType(column.Attributes & 0xFFF)
	}
	return msiType(column.Attributes & 0xF00)
}

func decodeMsiPropertyTable(data []byte, table *msiTable, strings []string) (map[string]string, error) {
	if len(table.Cols) != 2 || table.Cols[0].Type() != msiString || table.Cols[1].Type() != msiStringLocalized {
		return nil, errors.New("unexpected Property table structure")
	}

	const rowSize = 4
	if len(data)%rowSize != 0 {
		return nil, errors.New("invalid Property table size")
	}

	rowCount := len(data) / rowSize
	reader := bytes.NewReader(data)
	cols := make([][]uint16, 2)
	for i := 0; i < 2; i++ {
		cols[i] = make([]uint16, 0, rowCount)
		for j := 0; j < rowCount; j++ {
			var value uint16
			if err := binary.Read(reader, binary.LittleEndian, &value); err != nil {
				return nil, err
			}
			cols[i] = append(cols[i], value)
		}
	}

	props := make(map[string]string, rowCount)
	for i := 0; i < rowCount; i++ {
		keyIndex := int(cols[0][i]) - 1
		valueIndex := int(cols[1][i]) - 1
		if keyIndex < 0 || keyIndex >= len(strings) {
			continue
		}
		if valueIndex < 0 || valueIndex >= len(strings) {
			continue
		}
		props[strings[keyIndex]] = strings[valueIndex]
	}
	return props, nil
}

func decodeMsiPropertyTableColumns(data []byte, strings []string) (*msiTable, error) {
	const rowSize = 8
	if len(data)%rowSize != 0 {
		return nil, errors.New("invalid _Columns table size")
	}

	rowCount := len(data) / rowSize
	reader := bytes.NewReader(data)
	cols := make([][]uint16, 4)
	for i := 0; i < 4; i++ {
		cols[i] = make([]uint16, 0, rowCount)
		for j := 0; j < rowCount; j++ {
			var value uint16
			if err := binary.Read(reader, binary.LittleEndian, &value); err != nil {
				return nil, err
			}
			cols[i] = append(cols[i], value)
		}
	}

	var table msiTable
	for i := 0; i < rowCount; i++ {
		tableID := int(cols[0][i]) - 1
		colNum := int(cols[1][i])
		colNameID := int(cols[2][i]) - 1
		colAttr := cols[3][i]
		if tableID < 0 || tableID >= len(strings) {
			continue
		}
		if colNameID < 0 || colNameID >= len(strings) {
			continue
		}
		if strings[tableID] != "Property" {
			continue
		}
		table.Name = "Property"
		table.Cols = append(table.Cols, msiColumn{
			Number:     colNum,
			Name:       strings[colNameID],
			Attributes: colAttr,
		})
	}
	if table.Name == "" {
		return nil, errors.New("Property table not found in _Columns")
	}
	return &table, nil
}

func decodeMsiStrings(data []byte, pool []byte) ([]string, error) {
	if len(pool) < 4 {
		return nil, errors.New("invalid string pool")
	}

	poolReader := bytes.NewReader(pool[4:])
	dataReader := bytes.NewReader(data)
	result := make([]string, 0, 32)

	for {
		var entry struct {
			Size     uint16
			RefCount uint16
		}
		if err := binary.Read(poolReader, binary.LittleEndian, &entry); err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, err
		}

		size := uint32(entry.Size)
		if entry.Size == 0 && entry.RefCount != 0 {
			if err := binary.Read(poolReader, binary.LittleEndian, &size); err != nil {
				return nil, err
			}
		}

		if size == 0 {
			result = append(result, "")
			continue
		}

		buf := make([]byte, size)
		if _, err := io.ReadFull(dataReader, buf); err != nil {
			return nil, err
		}
		result = append(result, string(buf))
	}

	return result, nil
}

func msiDecodeStreamName(raw string) string {
	out := strings.Builder{}
	for _, char := range raw {
		switch {
		case char >= 0x3800 && char < 0x4800:
			char -= 0x3800
			out.WriteRune(msiDecodeRune(char & 0x3f))
			out.WriteRune(msiDecodeRune(char >> 6))
		case char >= 0x4800 && char < 0x4840:
			char -= 0x4800
			out.WriteRune(msiDecodeRune(char))
		case char == 0x4840:
			out.WriteString("Table.")
		default:
			out.WriteRune(char)
		}
	}
	return out.String()
}

func msiDecodeRune(value rune) rune {
	switch {
	case value < 10:
		return value + '0'
	case value < 10+26:
		return value - 10 + 'A'
	case value < 10+26+26:
		return value - 10 - 26 + 'a'
	case value == 10+26+26:
		return '.'
	default:
		return '_'
	}
}
