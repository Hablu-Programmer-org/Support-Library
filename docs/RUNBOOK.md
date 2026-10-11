# Support Library - Operations Runbook

## Post-Deploy Monitoring

### Live Log Monitoring
```bash
docker logs -f hablu-support-library
```

### Health Check Loop (every 60s)
```bash
watch -n 60 'curl -s https://support.hablu-programmer.com/api/health/ready | jq .ok'
```

### Quick Health Check (one-off)
```bash
curl -s https://support.hablu-programmer.com/api/health/ready | jq .
curl -s https://support.hablu-programmer.com/api/health/live | jq .
```

### Container Logs (last 100 lines)
```bash
docker logs hablu-support-library --tail 100
```

### Container Shell Access
```bash
docker exec -it hablu-support-library sh
```

## Emergency Procedures

### Restart App Container
```bash
docker restart hablu-support-library
```

### Rollback (Manual)
```bash
# On VPS
cd /opt/hablu-support-library
docker compose -f compose.production.yml down
git checkout <previous-sha>
docker compose -f compose.production.yml up -d --build --force-recreate
```

## Useful Links
- Atlas Dashboard: https://cloud.mongodb.com/
- GitHub Actions: https://github.com/Hablu-Programmer-org/Hablu-Support-Library/actions
- UptimeRobot: https://uptimerobot.com/