<template>
	<div style="display: flex; gap: 10px">
		<ClientOnly>
			<MosaicCanvas
				:width="canvasWidth"
				:height="canvasHeight"
				:columns="gridColumns"
				:rows="gridRows"
				:colorBlending="colorBlending"
				:target="targetImage"
				:sources="imageSources"
				@onClick="handleCanvasClick"
				@onLoadProgress="handleLoadProgress"
			>
			</MosaicCanvas>
		</ClientOnly>
		<div>
			<img :src="targetImage" :width="canvasWidth" :height="608" />
		</div>
	</div>
</template>

<script setup lang="ts">
interface MosaicImageInfo {
	column: number;
	row: number;
	color: number;
	image: HTMLImageElement;
}

const canvasWidth = 800;
const canvasHeight = 600;
const gridColumns = 180;
const gridRows = 180;
const colorBlending = 0.8;
const targetImage = `/anh-dep.png`;
const imageSources = ref<any>([]);

const handleCanvasClick = (info: MosaicImageInfo) => {
	console.log("Clicked on canvas:", info);
};

const handleLoadProgress = (progress: number) => {
	console.log("Image load progress:", progress);
};

onMounted(() => {
	const importImages = import.meta.glob("/public/img/*.(jpg|jpeg|png|gif)");
	const getRelativePath = (path: string) => {
		const relativePath = path.replace("/public", ""); // Loại bỏ /public từ đường dẫn
		return relativePath; // Trả về đường dẫn tương đối
	};
	let arr: any = [];
	const imagePromises = Object.keys(importImages).map((key) => {
		return importImages[key]().then(() => {
			const fileName = getRelativePath(key);
			arr.push(fileName);
		});
	});

	Promise.all(imagePromises).then(() => {
		imageSources.value = arr;
	});
});
</script>

<style scoped></style>
