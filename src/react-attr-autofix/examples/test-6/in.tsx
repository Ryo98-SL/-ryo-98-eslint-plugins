import {Modal} from "../modal.tsx";


const MyFc = () => {

    return <>
        <SimpleFc onDispose={() => {
            console.log('Dispose');
        }} />

        <Modal pattern={/\d/}  onClose={() => { console.log('Modal closed'); } }/>
    </>
}


type ByAlias = { pop?: { count: number}, onDispose?: () => void }

interface ByInterface { pop?: { count: number, onDispose?: () => void} }

const SimpleFc: React.FC<{ pop?: { count: number, }, onDispose?: () => void }> = () => {
    return <div>123</div>
}