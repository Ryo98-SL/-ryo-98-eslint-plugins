import { Theme, Box } from "@mui/material";
import { SxProps } from "@mui/system";


function MyComponent() {

    return <Box sx={BoxSx}></Box>
}
const BoxSx: SxProps<Theme> | undefined = { width: 1 };
