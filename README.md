
### help command to build:
- UID=$(id -u) GID=$(id -g) docker compose up

### environment variables:
- DEBUG=true - debug mode changes backend to localhost:3999


Users:
- id
- login
- password
- mail
  
Family:
- main_user_id
- client_user_id
- status: [Pending, Accepted]
  
Device:
- id
- user_id - nullable
- day_collection_interval
- night_collection_interval
- day_start
- day_end
- privacy: [Private, Public, Protected] - no, all, limited GPS
- battery
  
Measurements:
- device_id
- humidity
- temperature
- pressure
- PM2.5
- PM10
- longitude
- latitude
- time