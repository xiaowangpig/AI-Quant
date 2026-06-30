#!/usr/bin/env python3
"""Fetch BOE (京东方A, 000725.SZ) daily data from Tushare API for the past year."""

import json
import requests
from datetime import datetime, timedelta

TOKEN = "8e7cf9739409df84fb1e99d1e2c3b07fed24e0ff2cfb3a48159a5eeb"
API_URL = "https://api.tushare.pro"
TS_CODE = "000725.SZ"  # 京东方A

# Calculate date range: past 1 year
end_date = datetime.now().strftime("%Y%m%d")
start_date = (datetime.now() - timedelta(days=365)).strftime("%Y%m%d")

print(f"Fetching {TS_CODE} data from {start_date} to {end_date}")

# Step 1: Get daily data (K-line)
payload = {
    "api_name": "daily",
    "token": TOKEN,
    "params": {
        "ts_code": TS_CODE,
        "start_date": start_date,
        "end_date": end_date
    }
}

resp = requests.post(API_URL, json=payload)
data = resp.json()

print(f"API Response code: {data.get('code')}")
if data.get('code') != 0:
    print(f"Error: {data.get('msg')}")
    print(f"Full response: {json.dumps(data, indent=2, ensure_ascii=False)}")
    exit(1)

items = data.get('data', {})
fields = items.get('fields', [])
records = items.get('items', [])

print(f"Fields: {fields}")
print(f"Records count: {len(records)}")

if len(records) > 0:
    print(f"Oldest record: {records[-1]}")
    print(f"Newest record: {records[0]}")

# Save to JSON
output = {
    "ts_code": TS_CODE,
    "name": "京东方A",
    "start_date": start_date,
    "end_date": end_date,
    "fields": fields,
    "records": records
}

output_path = "D:\\@我的电脑文件整理\\北大量化交易工作坊\\boe_data.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"\nData saved to: {output_path}")

# Also save as CSV
import csv
csv_path = "D:\\@我的电脑文件整理\\北大量化交易工作坊\\boe_data.csv"
with open(csv_path, "w", encoding="utf-8-sig", newline="") as f:
    writer = csv.writer(f)
    writer.writerow(fields)
    writer.writerows(records)

print(f"CSV saved to: {csv_path}")
