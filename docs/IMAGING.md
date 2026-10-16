# FedMed imaging model: 3D U-Net for volumetric MRI segmentation

This document describes the medical-imaging module in `backend/app/imaging`, how to
run it, what it needs, and — importantly — what it is not.

## Status

Implemented and verified:

| Component | Where | Verified by |
|---|---|---|
| Configurable 3D U-Net | `imaging/unet.py` | `tests/test_imaging_unet.py` |
| MONAI preprocessing | `imaging/preprocess.py` | `tests/test_imaging_preprocess.py` |
| Case-level dataset split | `imaging/dataset.py` | `tests/test_imaging_preprocess.py` |
| Training loop + checkpoints | `imaging/train.py` | `tests/test_imaging_train.py` |
| Dice / IoU / sensitivity / specificity | `imaging/metrics.py` | `tests/test_imaging_metrics.py` |
| End-to-end experiment | `imaging/pipeline.py` | `tests/test_imaging_pipeline.py` |
| Federated client backend | `federated/backends.py` | `tests/test_imaging_federated.py` |

**This is a research prototype.** It is not a medical device, it has not been
clinically validated, and no number it produces is a clinical result. Do not use
it to make any decision about a patient.

## Tensor shapes

```
input      (N, 1, D, H, W)      float32, raw intensities (normalised by the pipeline)
output     (N, 1, D, H, W)      float32, RAW LOGITS
```

Two consequences that are easy to get wrong:

- **The output is logits, not probabilities.** `BCEWithLogitsLoss` expects logits,
  and Dice converts with a sigmoid at a chosen threshold. Returning probabilities
  would silently double-apply a sigmoid.
- **Each spatial dimension must be divisible by `2 ** stages`.** With the default
  3 stages that is 8. The bottleneck adds one downsampling below the deepest
  encoder feature map, so the requirement is tighter than it first appears. It is
  validated with an explicit error naming the offending axis.

Default model: `features=(8, 16, 32)`, **350,809 parameters**, 3 stages.

## Preprocessing pipeline

Applied in this order, by `imaging/preprocess.py`:

1. `LoadImaged` — read NIfTI, keeping the affine
2. `EnsureChannelFirstd` — `(D,H,W)` → `(1,D,H,W)`
3. `Orientationd` — reorient to a canonical axis code (default `RAS`)
4. `Spacingd` — resample to a common voxel size (default 1 mm isotropic)
5. `ResizeWithPadOrCropd` — pad or crop to a fixed shape (default `32³`)
6. `NormalizeIntensityd` — z-score over non-zero voxels
7. `Lambdad` — label `> 0` becomes binary foreground

Two ordering decisions that were wrong in earlier revisions and are now covered by
tests:

- **Normalisation runs after the resize.** Normalising a whole volume and then
  cropping it leaves the tensor the network receives unstandardised, because the
  cropped region's statistics differ from the ones the normalisation measured.
  Measured effect of the fix: model input went from `mean 0.68, std 1.72` to
  `mean 0.00, std 1.00`.
- **The label is resampled with nearest-neighbour, the image with bilinear.**
  Interpolating a label invents fractional class values and blurs boundaries,
  corrupting every Dice score computed against it.

## Compute requirements

Measured on this machine: **Intel i7-7820HQ, 7.9 GB RAM, Intel HD Graphics 630,
no CUDA GPU**, `torch 2.14.1+cpu`.

| Item | Measured |
|---|---|
| Memory | Fits comfortably in 7.9 GB; no swap observed |
| One epoch, 3 cases at 32³, batch 1 | ~1.2 s |
| Full 4-epoch experiment, HOSP-01 | 5.1 s |
| Full imaging test suite | under 2 minutes |

The model is sized for this: 350k parameters, 32³ inputs. A CUDA GPU is **not
required** and not assumed. Nothing in this module checks for one or degrades
without one; it simply runs on the CPU.

## Reproducing the experiment

From `D:\FedMed-Axlero-Internship\backend` (Command Prompt):

```cmd
..\.venv\Scripts\python.exe -m app.imaging.pipeline --site HOSP-01 --epochs 4 --seed 42 --out experiments\imaging
```

Expected shape of the output (measured, HOSP-01, seed 42):

```
epoch   train_loss   val_loss   val_dice   val_iou   secs
    1       0.5611     0.4723     0.9118    0.8380    1.3
    2       0.4582     0.4436     0.9519    0.9081    1.2
    3       0.4365     0.4316     0.9623    0.9273    1.2
    4       0.4259     0.4228     0.9710    0.9436    1.2

loss        : 0.5611 -> 0.4259 (improved: True)
best Dice   : 0.9710 at epoch 4
reloaded    : Dice 0.9710 loss 0.4228 over 1 validation case(s)
parameters  : 350,809
```

These figures come from **one validation case** on synthetic phantoms. A Dice of
0.97 on a single synthetic ellipsoid is *not* evidence of segmentation
performance on real scans, and is reported here only so the command can be checked
against something.

Useful flags:

| Flag | Default | Notes |
|---|---|---|
| `--site` | `HOSP-01` | `HOSP-01`, `HOSP-02`, `HOSP-03` — different phantom profiles |
| `--epochs` | 4 | |
| `--batch-size` | 1 | |
| `--seed` | 42 | Drives data, weights and the loop |
| `--validation-fraction` | 0.34 | Fraction of **cases**, not patches |
| `--target-shape D H W` | `32 32 32` | Each must be divisible by 8 |
| `--data-dir` | — | Directory of real NIfTI cases; omit for synthetic phantoms |
| `--out` | `experiments/imaging` | Where `experiment.json` and checkpoints go |

Tests:

```cmd
..\.venv\Scripts\python.exe -m pytest tests\test_imaging_unet.py tests\test_imaging_metrics.py tests\test_imaging_train.py tests\test_imaging_preprocess.py tests\test_imaging_pipeline.py tests\test_imaging_federated.py -v
```

## Using real research data

The script never downloads anything. If you want real data, obtain it yourself and
point `--data-dir` at it.

**Required layout** — each case is an image plus its mask, matched by name:

```
my-data/
  case_000.nii.gz        <- image
  case_000_seg.nii.gz    <- label (same geometry)
  case_001.nii.gz
  case_001_seg.nii.gz
```

Any `.nii`/`.nii.gz` pair works. Files ending `_seg.nii.gz` are treated as labels,
never as cases.

### Candidate public datasets

You must verify the current licence and terms yourself before use — they change,
and several require an application. This table is a starting point, not legal
advice.

| Dataset | Content | Access | Notes |
|---|---|---|---|
| **Medical Segmentation Decathlon**, Task01 Brain Tumour | Multi-modal brain MRI with tumour labels | Open download from the MSD site / AWS Open Data | The most practical starting point: no application, permissive research licence, NIfTI, labels included |
| **MSD**, Task02 Heart, Task03 Liver, etc. | Other segmentation tasks | Same as above | Useful to test the pipeline transfers beyond brain |
| **BraTS** (Brain Tumor Segmentation) | Multi-modal brain MRI, tumour sub-regions | Registration + signed data agreement | Larger and more realistic; **requires an application**, and the licence restricts redistribution |
| **ACDC** (cardiac MRI) | Short-axis cardiac cine with labels | Registration | Different anatomy and 2D+t; would need pipeline changes |
| **OASIS / IXI** | Structural brain MRI | Application (OASIS), open (IXI) | Mostly unlabelled, so not directly usable for supervised Dice |

### Storage

Plan for materially more disk than the raw archives suggest, because preprocessing
adds a copy:

- A few hundred to a few thousand NIfTI cases typically lands in the **single-digit
  to low-tens of GB**. BraTS-scale collections are at the larger end; MSD Task01 is
  around several GB.
- Preprocessed outputs at `32³` float32 are tiny (~128 KB per case), so the
  preprocessed cache is not the constraint — the raw data is.
- Check free space before downloading: `dir D:\`.

### Configuration

```cmd
..\.venv\Scripts\python.exe -m app.imaging.pipeline --data-dir D:\data\msd-task01 --epochs 10 --target-shape 64 64 64 --out experiments\msd
```

A few things to expect with real data:

- **Anisotropic real scans may not fit the crop.** `--target-shape` cropping to
  `32³` throws away most of a 240×240×155 volume. For real work you would use patch
  sampling rather than a whole-volume centre crop; that is not implemented here.
- **Real class imbalance is severe.** Many patches contain no lesion at all; the
  metrics already skip empty-both-sides samples and report how many they skipped
  (`samplesSkipped`), which is the number to look at.
- **The model is small.** 350k parameters at 32³ is a smoke-test architecture, not
  a competitive segmentation model.

## Connecting to federated training

The U-Net is registered as a client-model backend in `federated/backends.py`:

| Backend | Model | Trained on | Default |
|---|---|---|---|
| `tiny` | ~550-parameter stand-in | synthetic sphere patches | **yes** |
| `unet3d` | 350,809-parameter 3D U-Net | MONAI-preprocessed synthetic phantoms | no |

`tiny` remains the default so existing experiments keep measuring what they
measured. Selecting `unet3d` does not change what the federated layer guarantees:

- **Parameters only leave a client.** `state_to_numpy` returns weights; the
  `ClientUpdate` field set is asserted by a test, so adding a data field fails the
  suite.
- **Compatibility is checked before aggregation.** `fedavg.validate_updates` rejects
  mismatched names, mismatched shapes, and NaN/inf values, naming the client and
  parameter. This is model-agnostic, and `tests/test_imaging_federated.py` asserts
  it specifically for the U-Net — two clients with different `features` are refused.
- **`execution` stays `local-simulation`.** Every client runs in one process on one
  machine. Using a real U-Net does not make this a cross-silo deployment.

See [FEDERATED.md](FEDERATED.md) for what a real cross-silo deployment would still
require.

## Limitations

Stated plainly, because the alternative is letting the numbers imply more than they
support:

1. **Not clinically validated.** No clinical evaluation has been performed, on this
   or any data. It is a research prototype.
2. **Synthetic training data by default.** The phantoms are mathematical ellipsoids
   with noise. A model that segments them has learned to find an ellipsoid.
3. **Small architecture.** 350k parameters, 3 stages. Not competitive, and not
   intended to be.
4. **Whole-volume crop, not patch sampling.** Real volumes are cropped to a fixed
   small shape rather than sampled in patches, so most of a real volume would go
   unused.
5. **No augmentation.** No flips, rotations, intensity jitter or elastic
   deformation, all of which real training would need.
6. **No registration, bias-field correction or skull stripping.**
7. **Single-modality input.** `in_channels=1`. BraTS and MSD brain tasks are
   multi-modal, which would need `in_channels=4`.
8. **Metrics on one or two validation cases** in the default configuration, so the
   reported Dice has a very wide confidence interval.
9. **No privacy mechanism.** No differential privacy, no secure aggregation, no
   homomorphic encryption. That is Stage 5.
