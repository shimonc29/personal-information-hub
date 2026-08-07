export function buildOnboardingProgress({ connected = false, fileCount = 0, areaCount = 0 } = {}) {
  const scanned = connected && fileCount > 0
  const organized = scanned && areaCount > 0
  const completed = Number(connected) + Number(scanned) + Number(organized)
  return {
    current: !connected ? 'connect' : !scanned ? 'scan' : !organized ? 'organize' : 'ready',
    completed,
    total: 3,
    ready: organized,
  }
}
