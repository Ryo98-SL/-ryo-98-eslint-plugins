import {Box} from "@mui/material";
import { Theme, SxProps } from "@mui/material";

function MyComponent() {

    return <Box sx={BoxSx}></Box>
}
const BoxSx: SxProps<Theme> | undefined = { width: 1 };
