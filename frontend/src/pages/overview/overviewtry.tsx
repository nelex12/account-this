import {
  Box,
  Card,
  CardContent,
  Stack,
  Typography
} from '@mui/material';

export default function OverviewPage() {
  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        p: 2,
        gap: '4'
      }}
    >
      <Box 
        sx={{
          display: 'flex',
          flexDirection: 'row',
          gap: '4'
        }}
      >
        <Card>
          <CardContent>
            <Typography>
              Инструменты в реестре
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography>
              Инструменты в реестре
            </Typography>
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <Typography>
              Инструменты в реестре
            </Typography>
          </CardContent>
        </Card>
      </Box>

      <Box
        sx={{
          flexGrow: 1,
          minWidth: 0,
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        <Stack>
          <Typography variant="h4">
            История учета
          </Typography>
        </Stack>

        <Stack>
          <Typography variant="h4">
            История учета
          </Typography>
        </Stack>
      </Box>
    </Box>
  );
}