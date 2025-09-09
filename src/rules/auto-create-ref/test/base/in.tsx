import {Dialog} from "../../../../share-comps/dialog.tsx";


const MyFc = () => <Dialog ref={dialogRef} width={genClose().getWidth()} />

const genClose = () => {
    return {
        base: () => {},
        getWidth: () => ({get: () => 1})
    }
}