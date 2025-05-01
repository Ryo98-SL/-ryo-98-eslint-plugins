

const MyFc = () => {

    return <SimpleFc onDispose={() => {
        console.log('Dispose');
    }} />
}


type ByAlias = { pop?: { count: number}, onDispose?: () => void }

interface ByInterface { pop?: { count: number, onDispose?: () => void} }

const SimpleFc: React.FC<{ pop?: { count: number, }, onDispose?: () => void }> = () => {
    return <div>123</div>
}