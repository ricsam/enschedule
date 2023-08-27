import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/700.css';
import { GlobalStyles } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import React from 'react';
import { Theme, useTheme } from './theme-provider';

export const MuiTheme = ({ children }: { children: React.ReactNode }) => {
  const [selectedTheme] = useTheme();
  const mode = selectedTheme === Theme.LIGHT ? 'light' : 'dark';
  const theme = React.useMemo(
    () =>
      createTheme({
        palette: {
          mode,
        },
        components: {
          MuiAppBar: {
            styleOverrides: {
              root: ({ theme }) =>
                mode === 'light'
                  ? {
                      backdropFilter: 'blur(8px)',
                      boxShadown: 'none',
                      borderStyle: 'solid',
                      borderWidth: 0,
                      borderBottomWidth: 'thin',
                      borderColor: theme.palette.divider,
                      backgroundColor: 'rgba(255,255,255,0.8)',
                    }
                  : {
                      backdropFilter: 'blur(8px)',
                      boxShadown: 'none',
                      borderStyle: 'solid',
                      borderWidth: 0,
                      borderBottomWidth: 'thin',
                      borderColor: theme.palette.divider,
                      backgroundColor: theme.palette.background.paper + 'cc',
                    },
            },
          },
        },
      }),
    [mode]
  );
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline enableColorScheme />
      <GlobalStyles
        styles={{
          body: {
            backgroundColor: theme.palette.mode === 'dark' ? '#020012' : '#F9FAFB',
          },
        }}
      />
      {children}
    </ThemeProvider>
  );
};
